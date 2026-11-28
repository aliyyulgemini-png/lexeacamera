import Joi from "joi";

const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const id = Joi.string().trim().uuid().messages({
  "string.guid": "{{#label}} harus berupa UUID yang valid",
});
const userId = Joi.string().trim().required(); // diisi dari req.user.id, bukan dari body

// ===================== JADWAL (read-only) =====================
export const getPublishedSchedulesValidation = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).optional(),
});

export const scheduleIdValidation = Joi.object({ id: id.required() });

// ===================== FORM REQUEST =====================
export const formIdValidation = Joi.object({
  id: id.required(),
  user_id: userId,
});

// Klik sel di tabel form request (batch)
export const upsertFormEntriesValidation = Joi.object({
  id: id.required(), // form id
  user_id: userId,
  entries: Joi.array()
    .items(
      Joi.object({
        employee_id: id.required(),
        date: Joi.string().pattern(DATE_REGEX).required().messages({
          "string.pattern.base": "date harus berformat YYYY-MM-DD",
        }),
        schedule_item_id: id.allow(null).required(), // null = hapus request di sel itu
      })
    )
    .min(1)
    .max(5000)
    .required(),
});

export const listFormsValidation = Joi.object({
  user_id: userId,
});

export const createRequestValidation = Joi.object({
  user_id: userId,
  employee_id: id.optional(), // kosong = karyawan milik akun yang login
  form_id: id.required(),
  date: Joi.string().pattern(DATE_REGEX).required().messages({
    "string.pattern.base": "date harus berformat YYYY-MM-DD",
  }),
  schedule_item_id: id.required(),
  note: Joi.string().trim().max(500).allow("", null).optional(),
});

export const updateRequestValidation = Joi.object({
  user_id: userId,
  id: id.required(),
  schedule_item_id: id.optional(),
  note: Joi.string().trim().max(500).allow("", null).optional(),
});

export const deleteRequestValidation = Joi.object({
  user_id: userId,
  id: id.required(),
});
