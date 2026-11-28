import { prisma } from "../../lib/database.js";
import { validate } from "../../validation/validation.js";
import { ResponseError } from "../../error/response-error.js";
import ownerScheduleService from "../owner/schedule-service.js";
import {
  getPublishedSchedulesValidation,
  scheduleIdValidation,
} from "../../validation/admin/schedule-request-validation.js";

/** Daftar jadwal yang sudah PUBLISHED. */
const getSchedules = async (request) => {
  const req = validate(getPublishedSchedulesValidation, request);

  const where = { status: "PUBLISHED" };
  if (req.year) where.month = { startsWith: `${req.year}-` };

  const data = await prisma.schedule.findMany({
    where,
    select: { id: true, month: true, title: true, notes: true, updated_at: true },
    orderBy: { month: "desc" },
  });

  return { data };
};

/** Detail jadwal (read-only). Jadwal DRAFT dianggap tidak ada. */
const getSchedule = async (request) => {
  const { id } = validate(scheduleIdValidation, request);

  const schedule = await prisma.schedule.findUnique({ where: { id }, select: { status: true } });
  if (!schedule || schedule.status !== "PUBLISHED") {
    throw new ResponseError(404, "Jadwal tidak ditemukan");
  }

  return ownerScheduleService.getScheduleDetail({ id });
};

export default { getSchedules, getSchedule };
