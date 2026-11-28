import scheduleService from "../../services/admin/schedule-service.js";
import scheduleRequestService from "../../services/admin/schedule-request-service.js";

// User yang login. Sesuaikan kalau middleware auth kamu menyimpannya di tempat lain
// (mis. req.auth.id / res.locals.user.id).
const currentUserId = (req) => req.user?.id;

// ===================== JADWAL (read-only) =====================
const getSchedules = async (req, res, next) => {
  try {
    const result = await scheduleService.getSchedules(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getSchedule = async (req, res, next) => {
  try {
    const result = await scheduleService.getSchedule({ id: req.params.id });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// ===================== FORM REQUEST =====================
const getForms = async (req, res, next) => {
  try {
    const result = await scheduleRequestService.listForms({ user_id: currentUserId(req) });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getForm = async (req, res, next) => {
  try {
    const result = await scheduleRequestService.getForm({ id: req.params.id, user_id: currentUserId(req) });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const upsertFormEntries = async (req, res, next) => {
  try {
    const result = await scheduleRequestService.upsertEntries({
      ...req.body,
      id: req.params.id,
      user_id: currentUserId(req),
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const createRequest = async (req, res, next) => {
  try {
    const result = await scheduleRequestService.createRequest({ ...req.body, user_id: currentUserId(req) });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const updateRequest = async (req, res, next) => {
  try {
    const result = await scheduleRequestService.updateRequest({
      ...req.body,
      id: req.params.id,
      user_id: currentUserId(req),
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const removeRequest = async (req, res, next) => {
  try {
    const result = await scheduleRequestService.deleteRequest({ id: req.params.id, user_id: currentUserId(req) });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default {
  getSchedules,
  getSchedule,
  getForms,
  getForm,
  upsertFormEntries,
  createRequest,
  updateRequest,
  removeRequest,
};
