import Joi from "joi";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const id = Joi.string().trim().uuid().messages({
  "string.guid": "{{#label}} harus berupa UUID yang valid",
});
const date = Joi.string().pattern(DATE_REGEX).messages({
  "string.pattern.base": "date harus berformat YYYY-MM-DD",
});
const color = Joi.string().pattern(COLOR_REGEX).messages({
  "string.pattern.base": "warna harus hex 6 digit, contoh #E53935",
});

export const getAllSpecialDateValidation = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).optional(),
  month: Joi.string().pattern(MONTH_REGEX).optional().messages({
    "string.pattern.base": "month harus berformat YYYY-MM, contoh 2026-12",
  }),
});

export const createSpecialDateValidation = Joi.object({
  date: date.required(),
  name: Joi.string().trim().min(1).max(100).required(),
  color: color.optional(),
  is_yearly: Joi.boolean().optional(),
});

export const updateSpecialDateValidation = Joi.object({
  id: id.required(),
  date: date.optional(),
  name: Joi.string().trim().min(1).max(100).optional(),
  color: color.optional(),
  is_yearly: Joi.boolean().optional(),
});

export const specialDateIdValidation = Joi.object({ id: id.required() });
