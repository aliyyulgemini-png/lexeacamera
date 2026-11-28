import { prisma } from "../../lib/database.js";
import { validate } from "../../validation/validation.js";
import { ResponseError } from "../../error/response-error.js";
import {
  toYmd,
  monthLabel,
  isFormOpen,
  applyApprovedRequests,
  ensureEmployeesExist,
  buildFormGrid,
} from "./schedule-helper.js";
import {
  getAllFormValidation,
  createFormValidation,
  updateFormValidation,
  idValidation,
  getFormRequestsValidation,
  reviewRequestsValidation,
} from "../../validation/owner/schedule-request-form-validation.js";

export const FORM_SELECT = {
  id: true,
  month: true,
  title: true,
  description: true,
  max_days_per_employee: true,
  allowed_item_ids: true,
  employee_ids: true,
  closes_at: true,
  status: true,
  created_at: true,
  updated_at: true,
};

const ITEM_BRIEF = { id: true, code: true, name: true, category: true, color: true, text_color: true };

const findFormOrFail = async (id) => {
  const form = await prisma.scheduleRequestForm.findUnique({ where: { id }, select: FORM_SELECT });
  if (!form) throw new ResponseError(404, "Form request tidak ditemukan");
  return form;
};

const ensureItemsValid = async (itemIds) => {
  if (!itemIds?.length) return;
  const found = await prisma.scheduleItem.count({ where: { id: { in: itemIds }, is_active: true } });
  if (found !== itemIds.length) {
    throw new ResponseError(400, "Ada allowed_item_ids yang tidak ditemukan / nonaktif");
  }
};

// Hitung jumlah request per status untuk beberapa form
const countByStatus = async (formIds) => {
  const rows = await prisma.scheduleRequest.groupBy({
    by: ["form_id", "status"],
    where: { form_id: { in: formIds } },
    _count: { _all: true },
  });
  const result = {};
  for (const fid of formIds) result[fid] = { total: 0, pending: 0, approved: 0, rejected: 0 };
  for (const r of rows) {
    result[r.form_id][r.status.toLowerCase()] = r._count._all;
    result[r.form_id].total += r._count._all;
  }
  return result;
};

const withComputed = (form, counts) => ({
  ...form,
  is_open: isFormOpen(form),
  request_count: counts?.[form.id] ?? { total: 0, pending: 0, approved: 0, rejected: 0 },
});

// ======================================================================

const getForms = async (request) => {
  const req = validate(getAllFormValidation, request);

  const where = {};
  if (req.year) where.month = { startsWith: `${req.year}-` };
  if (req.status) where.status = req.status;

  const forms = await prisma.scheduleRequestForm.findMany({
    where,
    select: FORM_SELECT,
    orderBy: { month: "desc" },
  });
  const counts = await countByStatus(forms.map((f) => f.id));

  return { data: forms.map((f) => withComputed(f, counts)) };
};

/** Detail form + tabel (semua karyawan x tanggal) berisi request yang masuk. */
const getForm = async (request) => {
  const { id } = validate(idValidation, request);
  const form = await findFormOrFail(id);
  const [counts, grid] = await Promise.all([countByStatus([id]), buildFormGrid(form)]);

  return { ...withComputed(form, counts), ...grid };
};

const createForm = async (request) => {
  const req = validate(createFormValidation, request);

  const exists = await prisma.scheduleRequestForm.findUnique({ where: { month: req.month }, select: { id: true } });
  if (exists) {
    throw new ResponseError(409, `Form request bulan ${req.month} sudah ada (id: ${exists.id})`);
  }
  await ensureItemsValid(req.allowed_item_ids);
  await ensureEmployeesExist(req.employee_ids);

  const form = await prisma.scheduleRequestForm.create({
    data: {
      month: req.month,
      title: req.title || `REQUEST SCHEDULE ${monthLabel(req.month)}`,
      description: req.description || null,
      max_days_per_employee: req.max_days_per_employee ?? null,
      allowed_item_ids: req.allowed_item_ids,
      employee_ids: req.employee_ids,
      closes_at: req.closes_at ?? null,
    },
    select: FORM_SELECT,
  });

  return { ...withComputed(form), ...(await buildFormGrid(form)) };
};

const updateForm = async (request) => {
  const { id, ...data } = validate(updateFormValidation, request);
  await findFormOrFail(id);
  if (data.allowed_item_ids) await ensureItemsValid(data.allowed_item_ids);
  if (data.employee_ids) await ensureEmployeesExist(data.employee_ids);

  const form = await prisma.scheduleRequestForm.update({ where: { id }, data, select: FORM_SELECT });
  const counts = await countByStatus([id]);
  return withComputed(form, counts);
};

const deleteForm = async (request) => {
  const { id } = validate(idValidation, request);
  await findFormOrFail(id);
  // Request di dalamnya ikut terhapus (cascade). Sel jadwal yang sudah terisi tidak berubah.
  await prisma.scheduleRequestForm.delete({ where: { id } });
  return { id };
};

/** Daftar request yang masuk ke sebuah form. */
const getFormRequests = async (request) => {
  const req = validate(getFormRequestsValidation, request);
  await findFormOrFail(req.id);

  const where = { form_id: req.id };
  if (req.status) where.status = req.status;
  if (req.employee_id) where.employee_id = req.employee_id;

  const rows = await prisma.scheduleRequest.findMany({
    where,
    select: {
      id: true,
      date: true,
      note: true,
      status: true,
      owner_note: true,
      reviewed_at: true,
      created_at: true,
      employee: { select: { id: true, name: true } },
      item: { select: ITEM_BRIEF },
    },
    orderBy: [{ date: "asc" }, { created_at: "asc" }],
  });

  return { data: rows.map((r) => ({ ...r, date: toYmd(r.date) })) };
};

/**
 * Setujui / tolak banyak request sekaligus.
 * Kalau APPROVED dan jadwal bulan itu sudah ada → sel langsung terisi.
 * Kalau jadwal belum ada → akan terisi otomatis saat jadwal dibuat.
 */
const reviewRequests = async (request) => {
  const req = validate(reviewRequestsValidation, request);

  const found = await prisma.scheduleRequest.findMany({
    where: { id: { in: req.request_ids } },
    select: { id: true, form: { select: { month: true } } },
  });
  if (found.length !== req.request_ids.length) {
    const ok = new Set(found.map((r) => r.id));
    const missing = req.request_ids.filter((rid) => !ok.has(rid));
    throw new ResponseError(404, `Request tidak ditemukan: ${missing.join(", ")}`);
  }

  await prisma.scheduleRequest.updateMany({
    where: { id: { in: req.request_ids } },
    data: { status: req.status, owner_note: req.owner_note || null, reviewed_at: new Date() },
  });

  let applied = 0;
  if (req.status === "APPROVED") {
    const byMonth = new Map();
    for (const r of found) {
      if (!byMonth.has(r.form.month)) byMonth.set(r.form.month, []);
      byMonth.get(r.form.month).push(r.id);
    }
    for (const [month, requestIds] of byMonth) {
      applied += await applyApprovedRequests({ month, requestIds });
    }
  }

  return { updated: req.request_ids.length, status: req.status, applied_to_schedule: applied };
};

export default { getForms, getForm, createForm, updateForm, deleteForm, getFormRequests, reviewRequests };
