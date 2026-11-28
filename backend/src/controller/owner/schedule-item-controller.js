import scheduleItemService from "../../services/owner/schedule-item-service.js";

const getAll = async (req, res, next) => {
  try {
    const result = await scheduleItemService.getItems(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const result = await scheduleItemService.getItem({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await scheduleItemService.createItem(req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await scheduleItemService.updateItem({ ...req.body, id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await scheduleItemService.deleteItem({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { getAll, get, create, update, remove };
