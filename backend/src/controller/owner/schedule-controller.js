import scheduleService from "../../services/owner/schedule-service.js";

const getAll = async (req, res, next) => {
  try {
    const result = await scheduleService.getSchedules(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const result = await scheduleService.getScheduleDetail({ id: req.params.id });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await scheduleService.createSchedule(req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await scheduleService.updateSchedule({ ...req.body, id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await scheduleService.deleteSchedule({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const upsertEntries = async (req, res, next) => {
  try {
    const result = await scheduleService.upsertEntries({ ...req.body, id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const addEmployees = async (req, res, next) => {
  try {
    const result = await scheduleService.addEmployees({ ...req.body, id: req.params.id });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const removeEmployee = async (req, res, next) => {
  try {
    const result = await scheduleService.removeEmployee({
      id: req.params.id,
      employee_id: req.params.employeeId,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const reorderEmployees = async (req, res, next) => {
  try {
    const result = await scheduleService.reorderEmployees({ ...req.body, id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default {
  getAll,
  get,
  create,
  update,
  remove,
  upsertEntries,
  addEmployees,
  removeEmployee,
  reorderEmployees,
};
