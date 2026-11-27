import Joi from "joi";

export const ITEM_CATEGORIES = ["SHIFT", "LEAVE", "OFF", "OTHER"];

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;                        // 2026-12
const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;  // 2026-12-25
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;                       // 09:00
const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;                              // #E36C09

// Semua id memakai UUID
const id = Joi.string().trim().uuid().messages({
  "string.guid": "{{#label}} harus berupa UUID yang valid",
});
const month = Joi.string().pattern(MONTH_REGEX).messages({
  "string.pattern.base": "month harus berformat YYYY-MM, contoh 2026-12",
});
const time = Joi.string().pattern(TIME_REGEX).allow(null).messages({
  "string.pattern.base": "jam harus berformat HH:mm, contoh 09:00",
});
const color = Joi.string().pattern(COLOR_REGEX).messages({
  "string.pattern.base": "warna harus hex 6 digit, contoh #E36C09",
});

// ===================== ITEM JADWAL =====================
export const getAllScheduleItemValidation = Joi.object({
  category: Joi.string().valid(...ITEM_CATEGORIES).optional(),
  is_active: Joi.boolean().optional(),
});

export const createScheduleItemValidation = Joi.object({
  code: Joi.string().trim().uppercase().min(1).max(10).required(),
  name: Joi.string().trim().min(1).max(100).required(),
  category: Joi.string().valid(...ITEM_CATEGORIES).default("SHIFT"),
  start_time: time.optional(),
  end_time: time.optional(),
  color: color.optional(),
  text_color: color.optional(),
  show_in_summary: Joi.boolean().optional(),
  sort_order: Joi.number().integer().min(0).max(100000).optional(),
});

export const updateScheduleItemValidation = Joi.object({
  id: id.required(),
  code: Joi.string().trim().uppercase().min(1).max(10).optional(),
  name: Joi.string().trim().min(1).max(100).optional(),
  category: Joi.string().valid(...ITEM_CATEGORIES).optional(),
  start_time: time.optional(),
  end_time: time.optional(),
  color: color.optional(),
  text_color: color.optional(),
  show_in_summary: Joi.boolean().optional(),
  sort_order: Joi.number().integer().min(0).max(100000).optional(),
  is_active: Joi.boolean().optional(),
});

export const idValidation = Joi.object({ id: id.required() });

// ===================== JADWAL =====================
export const getAllScheduleValidation = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).optional(),
});

export const createScheduleValidation = Joi.object({
  month: month.required(),
  title: Joi.string().trim().min(1).max(150).optional(),
  notes: Joi.string().trim().max(5000).allow("", null).optional(),
  // Wajib: dikirim frontend dari data karyawan yang sudah ada di DB.
  // Urutan array = urutan baris di tabel.
  employee_ids: Joi.array().items(id).min(1).max(1000).unique().required(),
});

export const updateScheduleValidation = Joi.object({
  id: id.required(),
  title: Joi.string().trim().min(1).max(150).optional(),
  notes: Joi.string().trim().max(5000).allow("", null).optional(),
});

export const upsertEntriesValidation = Joi.object({
  id: id.required(), // schedule id
  entries: Joi.array()
    .items(
      Joi.object({
        employee_id: id.required(),
        date: Joi.string().pattern(DATE_REGEX).required().messages({
          "string.pattern.base": "date harus berformat YYYY-MM-DD",
        }),
        // null = kosongkan sel
        schedule_item_id: id.allow(null).required(),
      })
    )
    .min(1)
    .max(5000)
    .required(),
});

export const addScheduleEmployeesValidation = Joi.object({
  id: id.required(),
  employee_ids: Joi.array().items(id).min(1).unique().required(),
});

export const removeScheduleEmployeeValidation = Joi.object({
  id: id.required(),
  employee_id: id.required(),
});

export const reorderScheduleEmployeesValidation = Joi.object({
  id: id.required(),
  employee_ids: Joi.array().items(id).min(1).unique().required(),
});
