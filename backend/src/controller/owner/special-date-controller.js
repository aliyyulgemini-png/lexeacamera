import specialDateService from "../../services/owner/special-date-service.js";

const getAll = async (req, res, next) => {
  try {
    const result = await specialDateService.getAll(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const result = await specialDateService.get({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await specialDateService.create(req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await specialDateService.update({ ...req.body, id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await specialDateService.remove({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { getAll, get, create, update, remove };
