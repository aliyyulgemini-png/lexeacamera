import { prisma } from "../../lib/database.js";
import { validate } from "../../validation/validation.js";
import { ResponseError } from "../../error/response-error.js";
import { toDate, toYmd, isRealDate, SPECIAL_DATE_SELECT, getSpecialDatesForMonth } from "./schedule-helper.js";
import {
  getAllSpecialDateValidation,
  createSpecialDateValidation,
  updateSpecialDateValidation,
  specialDateIdValidation,
} from "../../validation/owner/special-date-validation.js";

const format = (s) => ({ ...s, date: toYmd(s.date) });

const ensureRealDate = (date) => {
  if (!isRealDate(date)) throw new ResponseError(400, `Tanggal tidak valid: ${date}`);
};

const findOrFail = async (id) => {
  const found = await prisma.specialDate.findUnique({ where: { id }, select: SPECIAL_DATE_SELECT });
  if (!found) throw new ResponseError(404, "Tanggal spesial tidak ditemukan");
  return found;
};

/**
 * - ?month=2026-12 → tanggal spesial yang jatuh di bulan itu (yang berulang ikut, dengan tahun 2026)
 * - ?year=2026     → yang sekali saja di tahun itu + semua yang berulang (tanggal asli)
 * - tanpa query    → semua
 */
const getAll = async (request) => {
  const req = validate(getAllSpecialDateValidation, request);

  if (req.month) return { data: await getSpecialDatesForMonth(req.month) };

  const where = req.year
    ? {
        OR: [
          { is_yearly: true },
          { date: { gte: new Date(Date.UTC(req.year, 0, 1)), lt: new Date(Date.UTC(req.year + 1, 0, 1)) } },
        ],
      }
    : {};

  const rows = await prisma.specialDate.findMany({
    where,
    select: SPECIAL_DATE_SELECT,
    orderBy: [{ date: "asc" }, { name: "asc" }],
  });
  return { data: rows.map(format) };
};

const get = async (request) => {
  const { id } = validate(specialDateIdValidation, request);
  return format(await findOrFail(id));
};

const create = async (request) => {
  const req = validate(createSpecialDateValidation, request);
  ensureRealDate(req.date);

  const created = await prisma.specialDate.create({
    data: { ...req, date: toDate(req.date) },
    select: SPECIAL_DATE_SELECT,
  });
  return format(created);
};

const update = async (request) => {
  const { id, ...data } = validate(updateSpecialDateValidation, request);
  await findOrFail(id);
  if (data.date) {
    ensureRealDate(data.date);
    data.date = toDate(data.date);
  }

  const updated = await prisma.specialDate.update({ where: { id }, data, select: SPECIAL_DATE_SELECT });
  return format(updated);
};

const remove = async (request) => {
  const { id } = validate(specialDateIdValidation, request);
  await findOrFail(id);
  await prisma.specialDate.delete({ where: { id } });
  return { id };
};

export default { getAll, get, create, update, remove };
