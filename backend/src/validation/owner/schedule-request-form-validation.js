import Joi from "joi";

export const FORM_STATUSES = ["OPEN", "CLOSED"];
export const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const id = Joi.string().trim().uuid().messages({
  "string.guid": "{{#label}} harus berupa UUID yang valid",
});
const month = Joi.string().pattern(MONTH_REGEX).messages({
  "string.pattern.base": "month harus berformat YYYY-MM, contoh 2026-12",
});

// ===================== FORM REQUEST (owner) =====================
export const getAllFormValidation = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).optional(),
  status: Joi.string().valid(...FORM_STATUSES).optional(),
});

export const createFormValidation = Joi.object({
  month: month.required(),
  title: Joi.string().trim().min(1).max(150).optional(),
  description: Joi.string().trim().max(5000).allow("", null).optional(),
  max_days_per_employee: Joi.number().integer().min(1).max(31).allow(null).optional(),
  allowed_item_ids: Joi.array().items(id).unique().default([]),
  closes_at: Joi.date().iso().allow(null).optional(),
  // Baris tabel form: dikirim frontend dari data karyawan (urutan array = urutan baris)
  employee_ids: Joi.array().items(id).min(1).max(1000).unique().required(),
});

export const updateFormValidation = Joi.object({
  id: id.required(),
  title: Joi.string().trim().min(1).max(150).optional(),
  description: Joi.string().trim().max(5000).allow("", null).optional(),
  max_days_per_employee: Joi.number().integer().min(1).max(31).allow(null).optional(),
  allowed_item_ids: Joi.array().items(id).unique().optional(),
  closes_at: Joi.date().iso().allow(null).optional(),
  employee_ids: Joi.array().items(id).min(1).max(1000).unique().optional(),
  status: Joi.string().valid(...FORM_STATUSES).optional(),
});

export const idValidation = Joi.object({ id: id.required() });

export const getFormRequestsValidation = Joi.object({
  id: id.required(),
  status: Joi.string().valid(...REQUEST_STATUSES).optional(),
  employee_id: id.optional(),
});

export const reviewRequestsValidation = Joi.object({
  request_ids: Joi.array().items(id).min(1).max(1000).unique().required(),
  status: Joi.string().valid("APPROVED", "REJECTED").required(),
  owner_note: Joi.string().trim().max(500).allow("", null).optional(),
});
