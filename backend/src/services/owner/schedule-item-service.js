import { prisma } from "../../lib/database.js";
import { validate } from "../../validation/validation.js";
import { ResponseError } from "../../error/response-error.js";
import {
  getAllScheduleItemValidation,
  createScheduleItemValidation,
  updateScheduleItemValidation,
  idValidation,
} from "../../validation/owner/schedule-validation.js";

export const ITEM_SELECT = {
  id: true,
  code: true,
  name: true,
  category: true,
  start_time: true,
  end_time: true,
  color: true,
  text_color: true,
  show_in_summary: true,
  sort_order: true,
  is_active: true,
};

export const ITEM_ORDER = [{ sort_order: "asc" }, { code: "asc" }];

const ensureCodeAvailable = async (code, exceptId) => {
  const found = await prisma.scheduleItem.findUnique({ where: { code }, select: { id: true } });
  if (found && found.id !== exceptId) {
    throw new ResponseError(409, `Kode "${code}" sudah dipakai`);
  }
};

const findOrFail = async (id) => {
  const item = await prisma.scheduleItem.findUnique({ where: { id }, select: ITEM_SELECT });
  if (!item) throw new ResponseError(404, "Item jadwal tidak ditemukan");
  return item;
};

const getItems = async (request) => {
  const req = validate(getAllScheduleItemValidation, request);

  const where = {};
  if (req.category) where.category = req.category;
  if (req.is_active !== undefined) where.is_active = req.is_active;

  const data = await prisma.scheduleItem.findMany({ where, select: ITEM_SELECT, orderBy: ITEM_ORDER });
  return { data };
};

const getItem = async (request) => {
  const { id } = validate(idValidation, request);
  return findOrFail(id);
};

const createItem = async (request) => {
  const req = validate(createScheduleItemValidation, request);
  await ensureCodeAvailable(req.code);

  if (req.sort_order === undefined) {
    const last = await prisma.scheduleItem.aggregate({ _max: { sort_order: true } });
    req.sort_order = (last._max.sort_order ?? -1) + 1;
  }

  return prisma.scheduleItem.create({ data: req, select: ITEM_SELECT });
};

const updateItem = async (request) => {
  const { id, ...data } = validate(updateScheduleItemValidation, request);
  await findOrFail(id);
  if (data.code) await ensureCodeAvailable(data.code, id);

  return prisma.scheduleItem.update({ where: { id }, data, select: ITEM_SELECT });
};

const deleteItem = async (request) => {
  const { id } = validate(idValidation, request);
  await findOrFail(id);

  const [usedInSchedule, usedInRequest] = await Promise.all([
    prisma.scheduleEntry.count({ where: { schedule_item_id: id } }),
    prisma.scheduleRequest.count({ where: { schedule_item_id: id } }),
  ]);
  if (usedInSchedule > 0 || usedInRequest > 0) {
    throw new ResponseError(
      409,
      `Item sudah dipakai di ${usedInSchedule} sel jadwal dan ${usedInRequest} request. Nonaktifkan saja (is_active: false) agar riwayat tetap utuh.`
    );
  }

  await prisma.scheduleItem.delete({ where: { id } });
  return { id };
};

export default { getItems, getItem, createItem, updateItem, deleteItem };
