// Sesuaikan 3 import di bawah dengan path di project kamu
import { prisma } from "../../lib/database.js";
import { validate } from "../../validation/validation.js";
import { ResponseError } from "../../error/response-error.js";
import { EMPLOYEE_SELECT, MONTH_NAMES } from "./schedule-config.js";
import { ITEM_SELECT, ITEM_ORDER } from "./schedule-item-service.js";
import {
  idValidation,
  getAllScheduleValidation,
  createScheduleValidation,
  updateScheduleValidation,
  upsertEntriesValidation,
  addScheduleEmployeesValidation,
  removeScheduleEmployeeValidation,
  reorderScheduleEmployeesValidation,
} from "../../validation/owner/schedule-validation.js";

const SCHEDULE_SELECT = {
  id: true,
  month: true,
  title: true,
  notes: true,
  created_at: true,
  updated_at: true,
};

// ---------- helper tanggal (UTC supaya tidak geser timezone) ----------
const toDate = (ymd) => new Date(`${ymd}T00:00:00.000Z`);
const toYmd = (date) => date.toISOString().slice(0, 10);
const isRealDate = (ymd) => toYmd(toDate(ymd)) === ymd;

const monthInfo = (month) => {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(y, m - 1, d));
    dates.push({
      date: toYmd(date),
      day: d,
      weekday: date.getUTCDay(), // 0 = Minggu ... 6 = Sabtu
      is_sunday: date.getUTCDay() === 0,
    });
  }
  return { year: y, monthNumber: m, daysInMonth, dates };
};

const findScheduleOrFail = async (id) => {
  const schedule = await prisma.schedule.findUnique({ where: { id }, select: SCHEDULE_SELECT });
  if (!schedule) throw new ResponseError(404, "Jadwal tidak ditemukan");
  return schedule;
};

// Pastikan semua employee_ids ada di tabel karyawan yang sudah ada
const ensureEmployeesExist = async (employeeIds) => {
  const found = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true },
  });
  if (found.length !== employeeIds.length) {
    const foundIds = new Set(found.map((e) => e.id));
    const missing = employeeIds.filter((id) => !foundIds.has(id));
    throw new ResponseError(404, `Karyawan tidak ditemukan: ${missing.join(", ")}`);
  }
};

// ======================================================================

const getSchedules = async (request) => {
  const req = validate(getAllScheduleValidation, request);

  const where = {};
  if (req.year) where.month = { startsWith: `${req.year}-` };

  const schedules = await prisma.schedule.findMany({
    where,
    select: { ...SCHEDULE_SELECT, _count: { select: { employees: true } } },
    orderBy: { month: "desc" },
  });

  const data = schedules.map(({ _count, ...s }) => ({ ...s, employee_count: _count.employees }));
  return { data };
};

/**
 * Detail jadwal = semua yang dibutuhkan frontend untuk menggambar tabel:
 * header, daftar tanggal, item yang bisa dipilih, dan baris karyawan + isi selnya.
 */
const getScheduleDetail = async (request) => {
  const { id } = validate(idValidation, request);
  const schedule = await findScheduleOrFail(id);
  const { daysInMonth, dates } = monthInfo(schedule.month);

  const [rows, activeItems] = await Promise.all([
    prisma.scheduleEmployee.findMany({
      where: { schedule_id: id },
      select: {
        id: true,
        sort_order: true,
        employee: { select: EMPLOYEE_SELECT },
        entries: {
          select: { date: true, item: { select: { id: true, code: true, show_in_summary: true } } },
        },
      },
      orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    }),
    prisma.scheduleItem.findMany({ where: { is_active: true }, select: ITEM_SELECT, orderBy: ITEM_ORDER }),
  ]);

  // Item nonaktif yang masih terpakai di jadwal ini tetap dikirim supaya sel bisa diwarnai
  const itemMap = new Map(activeItems.map((i) => [i.id, i]));
  const usedInactiveIds = new Set();
  rows.forEach((r) => r.entries.forEach((e) => !itemMap.has(e.item.id) && usedInactiveIds.add(e.item.id)));
  if (usedInactiveIds.size) {
    const inactive = await prisma.scheduleItem.findMany({
      where: { id: { in: [...usedInactiveIds] } },
      select: ITEM_SELECT,
    });
    inactive.forEach((i) => itemMap.set(i.id, i));
  }
  const items = [...itemMap.values()];
  const summaryItems = items.filter((i) => i.show_in_summary);

  const data = rows.map((r) => {
    const days = {};
    const summary = Object.fromEntries(summaryItems.map((i) => [i.code, 0]));
    for (const e of r.entries) {
      days[toYmd(e.date)] = { schedule_item_id: e.item.id, code: e.item.code };
      if (summary[e.item.code] !== undefined) summary[e.item.code]++;
    }
    return {
      schedule_employee_id: r.id,
      sort_order: r.sort_order,
      employee: r.employee,
      days,
      summary,
    };
  });

  return {
    data: {
      ...schedule,
      days_in_month: daysInMonth,
      dates,
      items,
      summary_columns: summaryItems.map((i) => i.code),
      rows: data,
    },
  };
};

/**
 * Buat jadwal baru untuk 1 bulan. Tabel langsung berisi karyawan
 * dari employee_ids (dikirim frontend), semua sel masih kosong.
 */
const createSchedule = async (request) => {
  const req = validate(createScheduleValidation, request);

  const exists = await prisma.schedule.findUnique({ where: { month: req.month }, select: { id: true } });
  if (exists) {
    throw new ResponseError(409, `Jadwal bulan ${req.month} sudah ada (id: ${exists.id})`);
  }

  await ensureEmployeesExist(req.employee_ids);

  const { year, monthNumber } = monthInfo(req.month);
  const schedule = await prisma.schedule.create({
    data: {
      month: req.month,
      title: req.title || `SCHEDULE ${MONTH_NAMES[monthNumber - 1]} ${year}`,
      notes: req.notes || null,
      employees: {
        create: req.employee_ids.map((employee_id, index) => ({ employee_id, sort_order: index })),
      },
    },
    select: { id: true },
  });

  return getScheduleDetail({ id: schedule.id }).then((r) => r.data);
};

const updateSchedule = async (request) => {
  const { id, ...data } = validate(updateScheduleValidation, request);
  await findScheduleOrFail(id);
  return prisma.schedule.update({ where: { id }, data, select: SCHEDULE_SELECT });
};

const deleteSchedule = async (request) => {
  const { id } = validate(idValidation, request);
  await findScheduleOrFail(id);
  await prisma.schedule.delete({ where: { id } }); // baris & isi sel ikut terhapus (cascade)
  return { id };
};

/**
 * Isi / ubah / kosongkan banyak sel sekaligus.
 * schedule_item_id terisi → upsert, null → sel dikosongkan.
 */
const upsertEntries = async (request) => {
  const req = validate(upsertEntriesValidation, request);
  const schedule = await findScheduleOrFail(req.id);

  // 1. Tanggal harus nyata & berada di bulan jadwal
  for (const e of req.entries) {
    if (!isRealDate(e.date)) throw new ResponseError(400, `Tanggal tidak valid: ${e.date}`);
    if (!e.date.startsWith(`${schedule.month}-`)) {
      throw new ResponseError(400, `Tanggal ${e.date} di luar bulan jadwal (${schedule.month})`);
    }
  }

  // 2. Karyawan harus ada di jadwal ini
  const scheduleEmployees = await prisma.scheduleEmployee.findMany({
    where: { schedule_id: req.id },
    select: { id: true, employee_id: true },
  });
  const seByEmployee = new Map(scheduleEmployees.map((se) => [se.employee_id, se.id]));
  const notInSchedule = [...new Set(req.entries.map((e) => e.employee_id))].filter((eid) => !seByEmployee.has(eid));
  if (notInSchedule.length) {
    throw new ResponseError(404, `Karyawan tidak ada di jadwal ini: ${notInSchedule.join(", ")}`);
  }

  // 3. Item harus ada & aktif
  const itemIds = [...new Set(req.entries.map((e) => e.schedule_item_id).filter(Boolean))];
  if (itemIds.length) {
    const items = await prisma.scheduleItem.findMany({
      where: { id: { in: itemIds }, is_active: true },
      select: { id: true },
    });
    if (items.length !== itemIds.length) {
      const ok = new Set(items.map((i) => i.id));
      const bad = itemIds.filter((i) => !ok.has(i));
      throw new ResponseError(400, `Item jadwal tidak ditemukan / nonaktif: ${bad.join(", ")}`);
    }
  }

  // 4. Sel yang sama dikirim >1x → pakai yang terakhir
  const unique = new Map();
  for (const e of req.entries) unique.set(`${e.employee_id}|${e.date}`, e);

  const ops = [...unique.values()].map((e) => {
    const schedule_employee_id = seByEmployee.get(e.employee_id);
    const date = toDate(e.date);
    if (e.schedule_item_id === null) {
      return prisma.scheduleEntry.deleteMany({ where: { schedule_employee_id, date } });
    }
    return prisma.scheduleEntry.upsert({
      where: { schedule_employee_id_date: { schedule_employee_id, date } },
      create: { schedule_employee_id, date, schedule_item_id: e.schedule_item_id },
      update: { schedule_item_id: e.schedule_item_id },
    });
  });

  await prisma.$transaction(ops);
  return { saved: ops.length };
};

/** Tambah karyawan ke jadwal yang sudah dibuat (mis. karyawan baru masuk). */
const addEmployees = async (request) => {
  const req = validate(addScheduleEmployeesValidation, request);
  await findScheduleOrFail(req.id);
  await ensureEmployeesExist(req.employee_ids);

  const existing = await prisma.scheduleEmployee.findMany({
    where: { schedule_id: req.id },
    select: { employee_id: true, sort_order: true },
  });
  const existingIds = new Set(existing.map((e) => e.employee_id));
  let nextOrder = existing.reduce((max, e) => Math.max(max, e.sort_order), -1) + 1;

  const toAdd = req.employee_ids.filter((eid) => !existingIds.has(eid));
  if (toAdd.length) {
    await prisma.scheduleEmployee.createMany({
      data: toAdd.map((employee_id) => ({ schedule_id: req.id, employee_id, sort_order: nextOrder++ })),
    });
  }

  return { added: toAdd.length, skipped: req.employee_ids.length - toAdd.length };
};

/** Keluarkan karyawan dari jadwal (isi selnya ikut terhapus). Data karyawan aslinya tidak tersentuh. */
const removeEmployee = async (request) => {
  const req = validate(removeScheduleEmployeeValidation, request);
  await findScheduleOrFail(req.id);

  const result = await prisma.scheduleEmployee.deleteMany({
    where: { schedule_id: req.id, employee_id: req.employee_id },
  });
  if (!result.count) throw new ResponseError(404, "Karyawan tidak ada di jadwal ini");

  return { employee_id: req.employee_id };
};

/** Ubah urutan baris. employee_ids harus berisi SEMUA karyawan di jadwal. */
const reorderEmployees = async (request) => {
  const req = validate(reorderScheduleEmployeesValidation, request);
  await findScheduleOrFail(req.id);

  const existing = await prisma.scheduleEmployee.findMany({
    where: { schedule_id: req.id },
    select: { employee_id: true },
  });
  const existingIds = new Set(existing.map((e) => e.employee_id));
  const sameSet =
    existingIds.size === req.employee_ids.length && req.employee_ids.every((eid) => existingIds.has(eid));
  if (!sameSet) {
    throw new ResponseError(400, "employee_ids harus berisi semua karyawan di jadwal ini, tanpa tambahan");
  }

  await prisma.$transaction(
    req.employee_ids.map((employee_id, index) =>
      prisma.scheduleEmployee.update({
        where: { schedule_id_employee_id: { schedule_id: req.id, employee_id } },
        data: { sort_order: index },
      })
    )
  );

  return { employee_ids: req.employee_ids };
};

export default {
  getSchedules,
  getScheduleDetail,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  upsertEntries,
  addEmployees,
  removeEmployee,
  reorderEmployees,
};
