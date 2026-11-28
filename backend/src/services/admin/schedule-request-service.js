import { prisma } from "../../lib/database.js";
import { validate } from "../../validation/validation.js";
import { ResponseError } from "../../error/response-error.js";
import { FORM_SELECT } from "../owner/schedule-request-form-service.js";
import {
  ITEM_BRIEF,
  toDate,
  toYmd,
  isRealDate,
  isFormOpen,
  getAllowedItems,
  quotaInfo,
  buildFormGrid,
} from "../owner/schedule-helper.js";
import {
  listFormsValidation,
  formIdValidation,
  upsertFormEntriesValidation,
  createRequestValidation,
  updateRequestValidation,
  deleteRequestValidation,
} from "../../validation/admin/schedule-request-validation.js";

const REQUEST_SELECT = {
  id: true,
  form_id: true,
  date: true,
  note: true,
  status: true,
  owner_note: true,
  reviewed_at: true,
  created_at: true,
  updated_at: true,
  employee: { select: { id: true, name: true } },
  item: { select: ITEM_BRIEF },
};

const EMPLOYEE_BRIEF = { id: true, name: true, is_active: true };

const formatRequest = (r) => ({ ...r, date: toYmd(r.date) });

// Karyawan milik akun admin yang login (lewat Employee.user_id). null kalau tidak terhubung.
const findOwnEmployee = (userId) =>
  prisma.employee.findUnique({ where: { user_id: userId }, select: EMPLOYEE_BRIEF });

/**
 * Karyawan yang dituju:
 * - employee_id dikirim → karyawan itu
 * - tidak dikirim       → karyawan milik akun yang login
 */
const resolveTargetEmployee = async (userId, employeeId) => {
  if (employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: EMPLOYEE_BRIEF });
    if (!employee || !employee.is_active) throw new ResponseError(404, "Karyawan tidak ditemukan / nonaktif");
    return employee;
  }

  const own = await findOwnEmployee(userId);
  if (!own || !own.is_active) {
    throw new ResponseError(400, "Akun kamu tidak terhubung ke data karyawan. Pilih karyawan (employee_id).");
  }
  return own;
};

const findFormOrFail = async (id) => {
  const form = await prisma.scheduleRequestForm.findUnique({ where: { id }, select: FORM_SELECT });
  if (!form) throw new ResponseError(404, "Form request tidak ditemukan");
  return form;
};

const ensureFormOpen = (form) => {
  if (!isFormOpen(form)) throw new ResponseError(400, "Form request sudah ditutup");
};

const ensureDateInForm = (form, date) => {
  if (!isRealDate(date)) throw new ResponseError(400, `Tanggal tidak valid: ${date}`);
  if (!date.startsWith(`${form.month}-`)) {
    throw new ResponseError(400, `Tanggal ${date} di luar bulan form (${form.month})`);
  }
};

const ensureItemAllowed = async (form, itemId) => {
  const allowed = await getAllowedItems(form);
  if (!allowed.some((i) => i.id === itemId)) {
    throw new ResponseError(400, "Item ini tidak bisa dipilih di form request ini");
  }
};

// ======================================================================

/** Semua form request. Kuota diisi kalau akun ini terhubung ke karyawan. */
const listForms = async (request) => {
  const req = validate(listFormsValidation, request);
  const own = await findOwnEmployee(req.user_id);

  const forms = await prisma.scheduleRequestForm.findMany({
    select: FORM_SELECT,
    orderBy: { month: "desc" },
  });

  let countMap = null;
  if (own) {
    const myCounts = await prisma.scheduleRequest.groupBy({
      by: ["form_id"],
      where: { employee_id: own.id, status: { in: ["PENDING", "APPROVED"] } },
      _count: { _all: true },
    });
    countMap = new Map(myCounts.map((c) => [c.form_id, c._count._all]));
  }

  const data = forms.map(({ allowed_item_ids, employee_ids, ...form }) => ({
    ...form,
    is_open: isFormOpen(form),
    employee_count: employee_ids.length,
    quota: countMap ? quotaInfo(form, countMap.get(form.id) ?? 0) : null,
  }));

  return { data };
};

/** Detail form dalam bentuk tabel: semua karyawan x tanggal, berisi request yang sudah masuk. */
const getForm = async (request) => {
  const req = validate(formIdValidation, request);
  const form = await findFormOrFail(req.id);
  const [own, grid] = await Promise.all([findOwnEmployee(req.user_id), buildFormGrid(form)]);
  const { allowed_item_ids, employee_ids, ...rest } = form;

  return {
    ...rest,
    is_open: isFormOpen(form),
    my_employee_id: own?.id ?? null, // untuk menandai baris milik admin yang login
    ...grid,
  };
};

/**
 * Klik sel di tabel form request (batch), sama seperti editor jadwal owner.
 * - schedule_item_id terisi → buat request baru, atau ganti item request PENDING di sel itu
 * - schedule_item_id null   → hapus request PENDING di sel itu
 * Sel yang sudah APPROVED / REJECTED tidak bisa diubah.
 * Semua perubahan dalam satu transaksi.
 */
const upsertEntries = async (request) => {
  const req = validate(upsertFormEntriesValidation, request);
  const form = await findFormOrFail(req.id);
  ensureFormOpen(form);

  // 1. Tanggal di bulan form, karyawan ada di form
  const formEmployees = new Set(form.employee_ids);
  for (const e of req.entries) {
    ensureDateInForm(form, e.date);
    if (!formEmployees.has(e.employee_id)) {
      throw new ResponseError(400, `Karyawan ${e.employee_id} tidak ada di form ini`);
    }
  }

  // 2. Item harus boleh dipilih
  const allowedIds = new Set((await getAllowedItems(form)).map((i) => i.id));
  const badItems = [
    ...new Set(req.entries.map((e) => e.schedule_item_id).filter((i) => i && !allowedIds.has(i))),
  ];
  if (badItems.length) {
    throw new ResponseError(400, `Item tidak bisa dipilih di form ini: ${badItems.join(", ")}`);
  }

  // 3. Sel yang sama dikirim >1x → pakai yang terakhir
  const unique = new Map();
  for (const e of req.entries) unique.set(`${e.employee_id}|${e.date}`, e);
  const entries = [...unique.values()];
  const employeeIds = [...new Set(entries.map((e) => e.employee_id))];

  // 4. Request yang sudah ada untuk karyawan-karyawan ini
  const existing = await prisma.scheduleRequest.findMany({
    where: { form_id: form.id, employee_id: { in: employeeIds } },
    select: { id: true, employee_id: true, date: true, status: true },
  });
  const existingMap = new Map(existing.map((r) => [`${r.employee_id}|${toYmd(r.date)}`, r]));

  // 5. Sel yang sudah diproses owner tidak boleh diubah
  const locked = entries.filter((e) => {
    const ex = existingMap.get(`${e.employee_id}|${e.date}`);
    return ex && ex.status !== "PENDING";
  });
  if (locked.length) {
    const list = locked.map((e) => e.date).join(", ");
    throw new ResponseError(409, `Request di tanggal ${list} sudah diproses owner, tidak bisa diubah`);
  }

  // 6. Cek kuota per karyawan setelah perubahan
  if (form.max_days_per_employee !== null) {
    const active = new Map(); // employee_id -> Set(date) untuk request PENDING/APPROVED
    for (const r of existing) {
      if (r.status === "REJECTED") continue;
      if (!active.has(r.employee_id)) active.set(r.employee_id, new Set());
      active.get(r.employee_id).add(toYmd(r.date));
    }
    for (const e of entries) {
      if (!active.has(e.employee_id)) active.set(e.employee_id, new Set());
      if (e.schedule_item_id) active.get(e.employee_id).add(e.date);
      else active.get(e.employee_id).delete(e.date);
    }
    const over = [...active.entries()].filter(([, dates]) => dates.size > form.max_days_per_employee);
    if (over.length) {
      const names = await prisma.employee.findMany({
        where: { id: { in: over.map(([eid]) => eid) } },
        select: { name: true },
      });
      throw new ResponseError(
        400,
        `Kuota habis (maksimal ${form.max_days_per_employee} hari): ${names.map((n) => n.name).join(", ")}`
      );
    }
  }

  // 7. Simpan
  const ops = [];
  for (const e of entries) {
    const ex = existingMap.get(`${e.employee_id}|${e.date}`);
    if (e.schedule_item_id === null) {
      if (ex) ops.push(prisma.scheduleRequest.delete({ where: { id: ex.id } }));
    } else if (ex) {
      ops.push(
        prisma.scheduleRequest.update({ where: { id: ex.id }, data: { schedule_item_id: e.schedule_item_id } })
      );
    } else {
      ops.push(
        prisma.scheduleRequest.create({
          data: {
            form_id: form.id,
            employee_id: e.employee_id,
            date: toDate(e.date),
            schedule_item_id: e.schedule_item_id,
          },
        })
      );
    }
  }

  if (ops.length) await prisma.$transaction(ops);
  return { saved: ops.length };
};

/** Kirim 1 request (alternatif selain klik sel). */
const createRequest = async (request) => {
  const req = validate(createRequestValidation, request);
  const employee = await resolveTargetEmployee(req.user_id, req.employee_id);
  const form = await findFormOrFail(req.form_id);
  ensureFormOpen(form);
  ensureDateInForm(form, req.date);
  await ensureItemAllowed(form, req.schedule_item_id);

  if (form.max_days_per_employee !== null) {
    const used = await prisma.scheduleRequest.count({
      where: { form_id: form.id, employee_id: employee.id, status: { in: ["PENDING", "APPROVED"] } },
    });
    if (used >= form.max_days_per_employee) {
      throw new ResponseError(400, `Kuota request ${employee.name} sudah habis (maksimal ${form.max_days_per_employee} hari)`);
    }
  }

  try {
    const created = await prisma.scheduleRequest.create({
      data: {
        form_id: form.id,
        employee_id: employee.id,
        date: toDate(req.date),
        schedule_item_id: req.schedule_item_id,
        note: req.note || null,
      },
      select: REQUEST_SELECT,
    });
    return formatRequest(created);
  } catch (error) {
    if (error.code === "P2002") {
      throw new ResponseError(409, `${employee.name} sudah punya request untuk tanggal ${req.date}`);
    }
    throw error;
  }
};

// Admin boleh mengubah / membatalkan request karyawan mana pun, selama masih PENDING
const findPendingRequest = async (id) => {
  const existing = await prisma.scheduleRequest.findUnique({
    where: { id },
    select: { id: true, status: true, form_id: true },
  });
  if (!existing) throw new ResponseError(404, "Request tidak ditemukan");
  if (existing.status !== "PENDING") {
    throw new ResponseError(409, "Request yang sudah diproses owner tidak bisa diubah / dihapus");
  }
  const form = await findFormOrFail(existing.form_id);
  ensureFormOpen(form);
  return { existing, form };
};

/** Ubah request PENDING, misalnya untuk menambah alasan (note). */
const updateRequest = async (request) => {
  const req = validate(updateRequestValidation, request);
  const { form } = await findPendingRequest(req.id);

  const data = {};
  if (req.schedule_item_id) {
    await ensureItemAllowed(form, req.schedule_item_id);
    data.schedule_item_id = req.schedule_item_id;
  }
  if (req.note !== undefined) data.note = req.note || null;

  const updated = await prisma.scheduleRequest.update({ where: { id: req.id }, data, select: REQUEST_SELECT });
  return formatRequest(updated);
};

/** Batalkan request PENDING. */
const deleteRequest = async (request) => {
  const req = validate(deleteRequestValidation, request);
  await findPendingRequest(req.id);

  await prisma.scheduleRequest.delete({ where: { id: req.id } });
  return { id: req.id };
};

export default { listForms, getForm, upsertEntries, createRequest, updateRequest, deleteRequest };
