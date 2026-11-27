import attendanceService from "../../services/owner/attendance-service.js";

const getAll = async (req, res, next) => {
  try {
    const result = await attendanceService.getAllAttendance(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const fixCheckout = async (req, res, next) => {
  try {
    const result = await attendanceService.fixCheckout({
      ...req.body,
      id: req.params.id,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const fixCheckin = async (req, res, next) => {
  try {
    const result = await attendanceService.fixCheckin({
      ...req.body,
      id: req.params.id,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};
export default { getAll, fixCheckout, fixCheckin };
