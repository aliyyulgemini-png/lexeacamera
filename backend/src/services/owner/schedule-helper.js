import { prisma } from "../../lib/database.js";
import { ResponseError } from "../../error/response-error.js";
import { EMPLOYEE_SELECT, MONTH_NAMES } from "./schedule-config.js";

// ---------- helper tanggal (UTC supaya tidak geser timezone) ----------
export const toDate = (ymd) => new Date(`${ymd}T00:00:00.000Z`);
export const toYmd = (date) => date.toISOString().slice(0, 10);
export const isRealDate = (ymd) => toYmd(toDate(ymd)) === ymd;

export const monthLabel = (month) => {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

// Form request dianggap terbuka kalau status OPEN dan belum lewat closes_at
export const isFormOpen = (form, now = new Date()) =>
  form.status === "OPEN" && (!form.closes_at || form.closes_at > now);

/**
 * Masukkan request yang sudah APPROVED ke sel jadwal bulan tersebut.
 * - Dipanggil saat owner approve request (kalau jadwalnya sudah ada).
 * - Dipanggil saat owner membuat jadwal baru (request yang sudah di-approve
 *   sebelumnya langsung terisi).
 * Request milik karyawan yang tidak ada di jadwal dilewati.
 * Mengembalikan jumlah sel yang diisi.
 */
export const applyApprovedRequests = async ({ month, requestIds }) => {
  const schedule = await prisma.schedule.findUnique({
    where: { month },
    select: { employees: { select: { id: true, employee_id: true } } },
  });
  if (!schedule) return 0;

  const seByEmployee = new Map(schedule.employees.map((se) => [se.employee_id, se.id]));

  const where = { status: "APPROVED", form: { month } };
  if (requestIds) where.id = { in: requestIds };

  const requests = await prisma.scheduleRequest.findMany({
    where,
    select: { employee_id: true, date: true, schedule_item_id: true },
  });

  const ops = requests
    .filter((r) => seByEmployee.has(r.employee_id))
    .map((r) => {
      const schedule_employee_id = seByEmployee.get(r.employee_id);
      return prisma.scheduleEntry.upsert({
        where: { schedule_employee_id_date: { schedule_employee_id, date: r.date } },
        create: { schedule_employee_id, date: r.date, schedule_item_id: r.schedule_item_id },
        update: { schedule_item_id: r.schedule_item_id },
      });
    });

  if (ops.length) await prisma.$transaction(ops);
  return ops.length;
};

// ======================================================================
// Tabel form request (dipakai owner & admin)
// ======================================================================

export const ITEM_BRIEF = {
  id: true,
  code: true,
  name: true,
  category: true,
  start_time: true,
  end_time: true,
  color: true,
  text_color: true,
};

/** Semua tanggal di bulan "YYYY-MM". weekday: 0 = Minggu ... 6 = Sabtu */
export const monthDates = (month) => {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(y, m - 1, d));
    dates.push({ date: toYmd(date), day: d, weekday: date.getUTCDay(), is_sunday: date.getUTCDay() === 0 });
  }
  return dates;
};

/** Item yang boleh dipilih di form: allowed_item_ids, atau semua item aktif kalau kosong. */
export const getAllowedItems = (form) =>
  prisma.scheduleItem.findMany({
    where: {
      is_active: true,
      ...(form.allowed_item_ids.length ? { id: { in: form.allowed_item_ids } } : {}),
    },
    select: ITEM_BRIEF,
    orderBy: [{ sort_order: "asc" }, { code: "asc" }],
  });

/** Kuota terpakai = request PENDING + APPROVED */
export const quotaInfo = (form, used) => ({
  max: form.max_days_per_employee,
  used,
  remaining: form.max_days_per_employee === null ? null : Math.max(form.max_days_per_employee - used, 0),
});

/** Pastikan semua id karyawan ada di tabel Employee. */
export const ensureEmployeesExist = async (employeeIds) => {
  const found = await prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true } });
  if (found.length !== employeeIds.length) {
    const ok = new Set(found.map((e) => e.id));
    const missing = employeeIds.filter((id) => !ok.has(id));
    throw new ResponseError(404, `Karyawan tidak ditemukan: ${missing.join(", ")}`);
  }
};

/**
 * Bangun tabel form request: tanggal, item yang bisa dipilih, dan baris karyawan.
 * Setiap sel yang berisi request memuat id, kode, warna, dan status request.
 */
export const buildFormGrid = async (form) => {
  const [employees, allowedItems, requests] = await Promise.all([
    prisma.employee.findMany({ where: { id: { in: form.employee_ids } }, select: EMPLOYEE_SELECT }),
    getAllowedItems(form),
    prisma.scheduleRequest.findMany({
      where: { form_id: form.id },
      select: {
        id: true,
        employee_id: true,
        date: true,
        status: true,
        note: true,
        owner_note: true,
        item: { select: { id: true, code: true, color: true, text_color: true } },
      },
    }),
  ]);

  const byEmployee = new Map();
  for (const r of requests) {
    if (!byEmployee.has(r.employee_id)) byEmployee.set(r.employee_id, []);
    byEmployee.get(r.employee_id).push(r);
  }

  // Urutan baris mengikuti form.employee_ids
  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  const rows = form.employee_ids
    .filter((eid) => employeeMap.has(eid))
    .map((eid) => {
      const list = byEmployee.get(eid) ?? [];
      const days = {};
      for (const r of list) {
        days[toYmd(r.date)] = {
          request_id: r.id,
          schedule_item_id: r.item.id,
          code: r.item.code,
          color: r.item.color,
          text_color: r.item.text_color,
          status: r.status,
          note: r.note,
          owner_note: r.owner_note,
        };
      }
      const used = list.filter((r) => r.status !== "REJECTED").length;
      return { employee: employeeMap.get(eid), days, quota: quotaInfo(form, used) };
    });

  const specials = await getSpecialDatesForMonth(form.month);
  return {
    dates: attachSpecialDates(monthDates(form.month), specials),
    special_dates: specials,
    allowed_items: allowedItems,
    rows,
  };
};

// ======================================================================
// Tanggal spesial (hari besar, tanggal kembar, dll)
// ======================================================================

export const SPECIAL_DATE_SELECT = { id: true, date: true, name: true, color: true, is_yearly: true };

/**
 * Tanggal spesial yang jatuh di bulan "YYYY-MM".
 * Tanggal berulang (is_yearly) dipindah ke tahun bulan tersebut.
 * Hasil: [{ id, date: "YYYY-MM-DD", name, color, is_yearly }] urut tanggal.
 */
export const getSpecialDatesForMonth = async (month) => {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const mm = String(m).padStart(2, "0");

  const [oneTime, yearly] = await Promise.all([
    prisma.specialDate.findMany({
      where: { is_yearly: false, date: { gte: start, lt: end } },
      select: SPECIAL_DATE_SELECT,
    }),
    prisma.specialDate.findMany({ where: { is_yearly: true }, select: SPECIAL_DATE_SELECT }),
  ]);

  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const list = [
    ...oneTime.map((s) => ({ ...s, date: toYmd(s.date) })),
    ...yearly
      .filter((s) => toYmd(s.date).slice(5, 7) === mm)
      .filter((s) => Number(toYmd(s.date).slice(8, 10)) <= daysInMonth) // 29 Feb di tahun biasa dilewati
      .map((s) => ({ ...s, date: `${month}-${toYmd(s.date).slice(8, 10)}` })),
  ];

  return list.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
};

/** Tempelkan tanggal spesial ke daftar tanggal (untuk titik di header). */
export const attachSpecialDates = (dates, specials) => {
  const byDate = new Map();
  for (const s of specials) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push({ id: s.id, name: s.name, color: s.color });
  }
  return dates.map((d) => ({ ...d, special_dates: byDate.get(d.date) ?? [] }));
};
