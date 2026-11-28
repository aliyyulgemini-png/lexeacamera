import scheduleRequestFormService from "../../services/owner/schedule-request-form-service.js";

const getAll = async (req, res, next) => {
  try {
    const result = await scheduleRequestFormService.getForms(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const result = await scheduleRequestFormService.getForm({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await scheduleRequestFormService.createForm(req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await scheduleRequestFormService.updateForm({ ...req.body, id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await scheduleRequestFormService.deleteForm({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getRequests = async (req, res, next) => {
  try {
    const result = await scheduleRequestFormService.getFormRequests({ ...req.query, id: req.params.id });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const review = async (req, res, next) => {
  try {
    const result = await scheduleRequestFormService.reviewRequests(req.body);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { getAll, get, create, update, remove, getRequests, review };
