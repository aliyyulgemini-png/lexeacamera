import express from "express";
import userController from "../controller/user-controller.js";
import adminCameraController from "../controller/admin/camera-controller.js";
import customerController from "../controller/admin/customer-controller.js";
import { uploadImages } from "../middleware/upload-image-middleware.js";
import invoiceController from "../controller/admin/invoice-controller.js";
import adminMarketplaceController from "../controller/admin/marketplace-controller.js";

import dashboardController from "../controller/admin/dashboard-controller.js";
import refundController from "../controller/admin/refund-controller.js";
import storeController from "../controller/owner/store-controller.js";
import termsController from "../controller/owner/terms-controller.js";
import salesController from "../controller/admin/sales-controller.js";
import attendanceController from "../controller/owner/attendance-controller.js";
import orderPaymentController from "../controller/admin/order-payment-controller.js";
import qcItemController from "../controller/admin/qc-item-controller.js";
import qcController from "../controller/admin/qc-controller.js";
import dailyReportController from "../controller/admin/daily-report-controller.js";
import employeeController from "../controller/owner/employee-controller.js";
import adminScheduleController from "../controller/admin/schedule-controller.js";
const adminRouter = express.Router();
adminRouter.put("/users/pin", userController.setPin);
adminRouter.get("/users/current", userController.get);
adminRouter.patch("/users/current/password", userController.updatePassword);
adminRouter.patch("/users/current/name", userController.updateName);
adminRouter.patch("/users/current/email", userController.updateEmail);
adminRouter.post("/users/current/logout", userController.logout);
adminRouter.get("/admin/cameras", adminCameraController.getAll);
adminRouter.get("/admin/cameras/:id", adminCameraController.get);
adminRouter.put(
  "/admin/cameras/:id/images",
  uploadImages(),
  adminCameraController.updateImages,
);
adminRouter.put(
  "/admin/cameras/:id/marketplace",
  adminCameraController.updateMarketplace,
);
adminRouter.get("/admin/customers", customerController.getAll);
adminRouter.get("/admin/customers/summary", customerController.getSummary);
adminRouter.post("/admin/customers", customerController.create);
adminRouter.get("/admin/customers/:id", customerController.get);
adminRouter.put("/admin/customers/:id", customerController.update);
adminRouter.delete("/admin/customers/:id", customerController.remove);
adminRouter.post("/admin/invoices", invoiceController.createInvoice);
adminRouter.get("/admin/invoices", invoiceController.getAllInvoice);
adminRouter.get("/admin/invoices/:id", invoiceController.getInvoice);
adminRouter.patch("/admin/invoices/:id", invoiceController.updateInvoice);
adminRouter.delete("/admin/invoices/:id", invoiceController.deleteInvoice);
adminRouter.get("/admin/dashboard", dashboardController.getDashboard);
adminRouter.post("/admin/orders/:id/refunds", refundController.create);
adminRouter.get("/admin/orders/:id/refunds", refundController.getByOrder);
adminRouter.delete("/admin/refunds/:id", refundController.remove);
adminRouter.get(
  "/admin/marketplaces",
  adminMarketplaceController.getAllMarketplace,
);
adminRouter.get("/store", storeController.getStore);
adminRouter.get("/terms", termsController.getTerms);
adminRouter.get("/admin/sales", salesController.get);
adminRouter.get("/owner/attendances", attendanceController.getAll);
adminRouter.patch(
  "/admin/orders/:id/payment-status",
  orderPaymentController.updatePaymentStatus,
);
adminRouter.patch("/admin/cameras/:id", adminCameraController.updateDetails);
adminRouter.get("/admin/qc-items", qcItemController.getAll);
adminRouter.post("/admin/qc-items", qcItemController.create);
adminRouter.patch("/admin/qc-items/:id", qcItemController.update);
adminRouter.delete("/admin/qc-items/:id", qcItemController.remove);

adminRouter.get("/admin/quality-controls", qcController.getAll);
adminRouter.post("/admin/quality-controls", qcController.create);
adminRouter.get("/admin/quality-controls/:id", qcController.get);
adminRouter.patch("/admin/quality-controls/:id", qcController.update);
adminRouter.patch("/admin/quality-controls/:id/status", qcController.setStatus);
adminRouter.delete("/admin/quality-controls/:id", qcController.remove);
adminRouter.post(
  "/admin/quality-controls/:id/media/upload-url",
  qcController.createUploadUrl,
);
adminRouter.post("/admin/quality-controls/:id/media", qcController.addMedia);
adminRouter.delete(
  "/admin/quality-controls/:id/media/:media_id",
  qcController.removeMedia,
);
adminRouter.get("/admin/daily-reports", dailyReportController.getAll);
adminRouter.get(
  "/admin/daily-reports/next-opening",
  dailyReportController.nextOpening,
);
adminRouter.get(
  "/admin/daily-reports/:id/history",
  dailyReportController.history,
);
adminRouter.get("/admin/daily-reports/:id", dailyReportController.get);
adminRouter.post("/admin/daily-reports", dailyReportController.create);
adminRouter.patch("/admin/daily-reports/:id", dailyReportController.update);
adminRouter.delete("/admin/daily-reports/:id", dailyReportController.remove);
adminRouter.post(
  "/admin/daily-reports/:id/entries",

  dailyReportController.createEntry,
);
adminRouter.get("/admin/employees", employeeController.getAll);

adminRouter.patch(
  "/admin/daily-reports/:id/entries/:entry_id",

  dailyReportController.updateEntry,
);
adminRouter.delete(
  "/admin/daily-reports/:id/entries/:entry_id",

  dailyReportController.removeEntry,
);
adminRouter.post(
  "/admin/daily-reports/:id/proof/upload-url",

  dailyReportController.createProofUploadUrl,
);
adminRouter.put(
  "/admin/daily-reports/:id/proof",

  dailyReportController.setProof,
);
adminRouter.delete(
  "/admin/daily-reports/:id/proof",

  dailyReportController.removeProof,
);

// ---------- Jadwal (read-only, hanya yang PUBLISHED) ----------
adminRouter.get("/admin/schedules", adminScheduleController.getSchedules);
adminRouter.get("/admin/schedules/:id", adminScheduleController.getSchedule);

// ---------- Form request jadwal ----------
adminRouter.get(
  "/admin/schedule-request-forms",
  adminScheduleController.getForms,
);
adminRouter.get(
  "/admin/schedule-request-forms/:id",
  adminScheduleController.getForm,
);
adminRouter.put(
  "/admin/schedule-request-forms/:id/entries",
  adminScheduleController.upsertFormEntries,
);
adminRouter.post(
  "/admin/schedule-requests",
  adminScheduleController.createRequest,
);
adminRouter.put(
  "/admin/schedule-requests/:id",
  adminScheduleController.updateRequest,
);
adminRouter.delete(
  "/admin/schedule-requests/:id",
  adminScheduleController.removeRequest,
);

export default adminRouter;
