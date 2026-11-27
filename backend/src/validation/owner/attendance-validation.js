import Joi from "joi";

const calendarDate = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    const parsed = new Date(`${value}T00:00:00Z`);

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      return helpers.error("any.invalid");
    }

    return value;
  });

const label = Joi.string().trim().min(1).max(100);
const cidr = Joi.string().trim().max(60);

export const idValidation = Joi.object({
  id: Joi.string().uuid().required(),
});

export const createNetworkValidation = Joi.object({
  label: label.required(),
  cidr: cidr.required(),
});

export const updateNetworkValidation = Joi.object({
  id: Joi.string().uuid().required(),
  label,
  cidr,
  is_active: Joi.boolean().strict(),
}).or("label", "cidr", "is_active");

export const createDeviceValidation = Joi.object({
  label: label.required(),
});

export const updateDeviceValidation = Joi.object({
  id: Joi.string().uuid().required(),
  label,
  is_active: Joi.boolean().strict(),
}).or("label", "is_active");

export const updateSettingValidation = Joi.object({
  require_network: Joi.boolean().strict().required(),
});

export const getAllAttendanceValidation = Joi.object({
  employee_id: Joi.string().uuid().optional(),
  date_from: calendarDate.optional(),
  date_to: calendarDate.optional(),
  page: Joi.number().integer().min(1).default(1),
});

export const fixCheckoutValidation = Joi.object({
  id: Joi.string().uuid().required(),
  check_out_at: Joi.date().iso().max("now").allow(null).required(),
});
export const fixCheckinValidation = Joi.object({
  id: Joi.string().uuid().required(),
  check_in_at: Joi.date().iso().required(),
});
