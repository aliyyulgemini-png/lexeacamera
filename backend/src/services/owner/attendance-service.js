import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import {
  fixCheckinValidation,
  fixCheckoutValidation,
  getAllAttendanceValidation,
} from "../../validation/owner/attendance-validation.js";
import { validate } from "../../validation/validation.js";

const PER_PAGE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const SELECT = {
  id: true,
  check_in_at: true,
  check_out_at: true,
  missed_checkout: true,
  employee: { select: { id: true, name: true } },
};

const wibDay = (date) =>
  new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);

const wibStart = (day) => new Date(`${day}T00:00:00+07:00`);

const serialize = ({ missed_checkout, ...row }, now = new Date()) => {
  let status = "OPEN";

  if (row.check_out_at) {
    status = "DONE";
  } else if (missed_checkout || wibDay(row.check_in_at) < wibDay(now)) {
    status = "MISSED";
  }

  return {
    ...row,
    status,
    duration_minutes: row.check_out_at
      ? Math.floor((row.check_out_at - row.check_in_at) / 60000)
      : null,
  };
};

const getAllAttendance = async (request) => {
  const req = validate(getAllAttendanceValidation, request);

  if (req.date_from && req.date_to && req.date_from > req.date_to) {
    throw new ResponseError(400, "INVALID_DATE_RANGE");
  }

  const where = {};
  if (req.employee_id) where.employee_id = req.employee_id;
  if (req.date_from || req.date_to) {
    where.check_in_at = {};
    if (req.date_from) where.check_in_at.gte = wibStart(req.date_from);
    if (req.date_to) {
      where.check_in_at.lt = new Date(wibStart(req.date_to).getTime() + DAY_MS);
    }
  }

  const [rows, total] = await prisma.$transaction([
    prisma.attendance.findMany({
      where,
      select: SELECT,
      orderBy: [{ check_in_at: "desc" }, { id: "asc" }],
      skip: (req.page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.attendance.count({ where }),
  ]);

  const now = new Date();

  return {
    data: rows.map((row) => serialize(row, now)),
    paging: {
      page: req.page,
      per_page: PER_PAGE,
      total,
      total_pages: Math.ceil(total / PER_PAGE),
    },
  };
};

const fixCheckout = async (request) => {
  const req = validate(fixCheckoutValidation, request);

  return prisma
    .$transaction(async (tx) => {
      const locked = await tx.$queryRaw`
        SELECT id FROM "Attendance" WHERE id = ${req.id} FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new ResponseError(404, "ATTENDANCE_NOT_FOUND");
      }

      const attendance = await tx.attendance.findUnique({
        where: { id: req.id },
        select: {
          id: true,
          employee_id: true,
          check_in_at: true,
          check_out_at: true,
        },
      });

      if (req.check_out_at === null) {
        if (attendance.check_out_at === null) {
          return serialize(
            await tx.attendance.findUnique({
              where: { id: req.id },
              select: SELECT,
            }),
          );
        }

        return serialize(
          await tx.attendance.update({
            where: { id: req.id },
            data: { check_out_at: null, missed_checkout: false },
            select: SELECT,
          }),
        );
      }

      if (req.check_out_at <= attendance.check_in_at) {
        throw new ResponseError(400, "CHECKOUT_BEFORE_CHECKIN");
      }
      if (
        req.check_out_at.getTime() - attendance.check_in_at.getTime() >
        DAY_MS
      ) {
        throw new ResponseError(400, "CHECKOUT_TOO_LATE");
      }

      const next = await tx.attendance.findFirst({
        where: {
          employee_id: attendance.employee_id,
          check_in_at: { gt: attendance.check_in_at },
        },
        orderBy: { check_in_at: "asc" },
        select: { check_in_at: true },
      });

      if (next && req.check_out_at > next.check_in_at) {
        throw new ResponseError(409, "OVERLAPS_NEXT_ATTENDANCE");
      }

      return serialize(
        await tx.attendance.update({
          where: { id: req.id },
          data: { check_out_at: req.check_out_at, missed_checkout: false },
          select: SELECT,
        }),
      );
    })
    .catch((error) => {
      if (error.code === "P2002") {
        throw new ResponseError(409, "ANOTHER_ATTENDANCE_OPEN");
      }

      throw error;
    });
};

const fixCheckin = async (request) => {
  const req = validate(fixCheckinValidation, request);

  return prisma
    .$transaction(async (tx) => {
      const locked = await tx.$queryRaw`
        SELECT id FROM "Attendance" WHERE id = ${req.id} FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new ResponseError(404, "ATTENDANCE_NOT_FOUND");
      }

      const attendance = await tx.attendance.findUnique({
        where: { id: req.id },
        select: {
          id: true,
          employee_id: true,
          check_in_at: true,
          check_out_at: true,
        },
      });

      const newIn = req.check_in_at;

      // Tidak boleh di masa depan
      if (newIn > new Date()) {
        throw new ResponseError(400, "CHECKIN_IN_FUTURE");
      }

      if (attendance.check_out_at) {
        // Jam masuk harus sebelum jam keluar, dan durasi maksimal 24 jam
        if (newIn >= attendance.check_out_at) {
          throw new ResponseError(400, "CHECKIN_AFTER_CHECKOUT");
        }
        if (attendance.check_out_at.getTime() - newIn.getTime() > DAY_MS) {
          throw new ResponseError(400, "DURATION_TOO_LONG");
        }
      } else if (wibDay(newIn) !== wibDay(attendance.check_in_at)) {
        // Absen yang belum checkout tidak boleh pindah hari,
        // supaya karyawan tetap bisa checkout seperti biasa
        throw new ResponseError(400, "OPEN_ATTENDANCE_DAY_CHANGE");
      }

      // Tidak boleh tumpang tindih dengan absen sebelum / sesudahnya
      const [prev, next] = await Promise.all([
        tx.attendance.findFirst({
          where: {
            employee_id: attendance.employee_id,
            id: { not: attendance.id },
            check_in_at: { lt: attendance.check_in_at },
          },
          orderBy: { check_in_at: "desc" },
          select: { check_in_at: true, check_out_at: true },
        }),
        tx.attendance.findFirst({
          where: {
            employee_id: attendance.employee_id,
            id: { not: attendance.id },
            check_in_at: { gt: attendance.check_in_at },
          },
          orderBy: { check_in_at: "asc" },
          select: { check_in_at: true },
        }),
      ]);

      if (prev && newIn < (prev.check_out_at ?? prev.check_in_at)) {
        throw new ResponseError(409, "OVERLAPS_PREVIOUS_ATTENDANCE");
      }
      if (next && newIn >= next.check_in_at) {
        throw new ResponseError(409, "OVERLAPS_NEXT_ATTENDANCE");
      }

      // 1 karyawan hanya 1 absen per hari (WIB)
      const dayStart = wibStart(wibDay(newIn));
      const sameDay = await tx.attendance.findFirst({
        where: {
          employee_id: attendance.employee_id,
          id: { not: attendance.id },
          check_in_at: {
            gte: dayStart,
            lt: new Date(dayStart.getTime() + DAY_MS),
          },
        },
        select: { id: true },
      });

      if (sameDay) {
        throw new ResponseError(409, "ANOTHER_ATTENDANCE_SAME_DAY");
      }

      return serialize(
        await tx.attendance.update({
          where: { id: req.id },
          data: { check_in_at: newIn },
          select: SELECT,
        }),
      );
    })
    .catch((error) => {
      if (error.code === "P2002") {
        throw new ResponseError(409, "ANOTHER_ATTENDANCE_OPEN");
      }

      throw error;
    });
};
export default { getAllAttendance, fixCheckout, fixCheckin };
