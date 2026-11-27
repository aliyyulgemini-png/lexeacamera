import express from "express";
import cameraController from "../controller/owner/camera-controller.js";
import categoryController from "../controller/owner/category-controller.js";
import storeController from "../controller/owner/store-controller.js";
import marketplaceController from "../controller/owner/marketplace-controller.js";
import invoiceController from "../controller/owner/invoice-controller.js";
import dashboardController from "../controller/owner/dashboard-controller.js";
import termsController from "../controller/owner/terms-controller.js";
import {
  uploadBanner,
  uploadImages,
  uploadLogo,
  uploadStoreImages,
} from "../middleware/upload-image-middleware.js";
import bannerController from "../controller/owner/banner-controller.js";
import updateCameraImageController from "../controller/shared/update-camera-image-controller.js";
import orderController from "../controller/owner/order-controller.js";
import employeeController from "../controller/owner/employee-controller.js";
import networkController from "../controller/owner/attendance-network-controller.js";
import attendanceController from "../controller/owner/attendance-controller.js";
import adminController from "../controller/owner/admin-controller.js";
import reportController from "../controller/owner/report-controller.js";
import cameraImportController from "../controller/owner/camera-import-controller.js";
import payrollController from "../controller/owner/payroll-controller.js";
import contractController from "../controller/owner/contract-controller.js";
import cameraBulkDeleteController from "../controller/owner/camera-bulk-delete-controller.js";
import attendanceDeviceController from "../controller/owner/attendance-device-controller.js";
import scheduleItemController from "../controller/owner/schedule-item-controller.js";
import scheduleController from "../controller/owner/schedule-controller.js";

const ownerRouter = express.Router();

ownerRouter.post("/category", categoryController.create);
ownerRouter.get("/category", categoryController.getAllCategory);
ownerRouter.patch("/category/:id", categoryController.updateCategory);
ownerRouter.delete("/category/:id", categoryController.deleteCategory);

ownerRouter.post(
  "/cameras",
  uploadImages("images"),
  cameraController.createCamera,
);
ownerRouter.get("/cameras/:id", cameraController.getCamera);
ownerRouter.patch("/cameras/:id", cameraController.updateCamera);
ownerRouter.delete("/cameras/:id", cameraController.deleteCamera);
ownerRouter.patch(
  "/cameras/:id/images",
  uploadImages(),
  updateCameraImageController.updateCameraImages,
);
ownerRouter.get("/marketplaces", marketplaceController.getAllMarketplace);
ownerRouter.get("/marketplaces/:id", marketplaceController.getMarketplace);
ownerRouter.post(
  "/marketplaces",
  uploadLogo(),
  marketplaceController.createMarketplace,
);
ownerRouter.patch(
  "/marketplaces/:id",
  uploadLogo(),
  marketplaceController.updateMarketplace,
);
ownerRouter.delete(
  "/marketplaces/:id",
  marketplaceController.deleteMarketplace,
);

ownerRouter.get("/banners/:id", bannerController.getBanner);
ownerRouter.post("/banners", uploadBanner(), bannerController.createBanner);
ownerRouter.patch(
  "/banners/:id",
  uploadBanner(),
  bannerController.updateBanner,
);
ownerRouter.delete("/banners/:id", bannerController.deleteBanner);
ownerRouter.post("/store", uploadStoreImages(), storeController.createStore);
ownerRouter.patch("/store", uploadStoreImages(), storeController.updateStore);
ownerRouter.get("/invoices/:id", invoiceController.getInvoice);

ownerRouter.get("/cameras", cameraController.getAllCamera);
//todo: edi tambah gambar camera dan get all dengan search produk(udah di atas ini)
ownerRouter.post("/invoices", invoiceController.createInvoice);
ownerRouter.get("/invoices", invoiceController.getAllInvoice);
ownerRouter.patch("/invoices/:id", invoiceController.updateInvoice);
ownerRouter.delete("/invoices/:id", invoiceController.deleteInvoice);
ownerRouter.get("/dashboard", dashboardController.getDashboard);
ownerRouter.put("/terms", termsController.updateTerms);
ownerRouter.get("/owner/orders", orderController.getAll);
ownerRouter.get("/owner/orders/:id", orderController.get);
ownerRouter.patch(
  "/owner/orders/:id/payment-status",
  orderController.updatePaymentStatus,
);
ownerRouter.post("/owner/employees", employeeController.create);
ownerRouter.get("/owner/employees", employeeController.getAll);
ownerRouter.get("/owner/employees/:id", employeeController.get);
ownerRouter.put("/owner/employees/:id", employeeController.update);
ownerRouter.post(
  "/owner/employees/:id/resend-verification",
  employeeController.resendVerification,
);
ownerRouter.get("/owner/attendance-networks", networkController.getAll);
ownerRouter.post("/owner/attendance-networks", networkController.create);
ownerRouter.put("/owner/attendance-networks/:id", networkController.update);
ownerRouter.delete("/owner/attendance-networks/:id", networkController.remove);
ownerRouter.get("/owner/attendance-settings", networkController.getSetting);
ownerRouter.put("/owner/attendance-settings", networkController.updateSetting);
ownerRouter.patch("/owner/attendances/:id", attendanceController.fixCheckout);
ownerRouter.post("/owner/admins", adminController.create);
ownerRouter.get("/owner/admins", adminController.getAll);
ownerRouter.get("/owner/admins/:id", adminController.get);
ownerRouter.patch("/owner/admins/:id", adminController.update);
ownerRouter.post(
  "/owner/admins/:id/resend-invite",
  adminController.resendInvite,
);
ownerRouter.get("/owner/reports/summary", reportController.summary);
ownerRouter.get("/owner/reports/trend", reportController.trend);
ownerRouter.get("/owner/reports/products", reportController.products);
ownerRouter.get("/owner/reports/categories", reportController.categories);
ownerRouter.get("/owner/reports/customers", reportController.customers);
ownerRouter.get(
  "/owner/reports/customers/summary",
  reportController.customerSegments,
);
ownerRouter.get("/owner/reports/transactions", reportController.transactions);
ownerRouter.get("/owner/reports/stock-value", reportController.stockValue);
ownerRouter.put("/owner/orders/:id/items", orderController.update);
ownerRouter.delete("/owner/employees/:id", employeeController.remove);
ownerRouter.post("/owner/cameras/import", cameraImportController.importCameras);
ownerRouter.post("/owner/payrolls", payrollController.create);
ownerRouter.get("/owner/payrolls", payrollController.getAll);
ownerRouter.get("/owner/payrolls/:id", payrollController.get);
ownerRouter.patch("/owner/payrolls/:id", payrollController.update);
ownerRouter.patch("/owner/payrolls/:id/status", payrollController.updateStatus);
ownerRouter.patch(
  "/owner/payrolls/:id/items/:item_id",
  payrollController.updateChecklist,
);
ownerRouter.delete("/owner/payrolls/:id", payrollController.remove);
ownerRouter.get(
  "/owner/employees/:id/payrolls",
  payrollController.getByEmployee,
);
ownerRouter.get("/owner/employees/:id/contracts", contractController.getAll);
ownerRouter.post("/owner/employees/:id/contracts", contractController.create);
ownerRouter.put(
  "/owner/employees/:id/contracts/:contract_id",
  contractController.update,
);
ownerRouter.delete(
  "/owner/employees/:id/contracts/:contract_id",
  contractController.remove,
);
ownerRouter.delete("/owner/orders/:id", orderController.remove);
ownerRouter.post(
  "/owner/cameras/bulk-delete",
  cameraBulkDeleteController.deleteMany,
);
ownerRouter.get("/owner/attendance-devices", attendanceDeviceController.getAll);
ownerRouter.post(
  "/owner/attendance-devices",
  attendanceDeviceController.create,
);
ownerRouter.put(
  "/owner/attendance-devices/:id",
  attendanceDeviceController.update,
);
ownerRouter.delete(
  "/owner/attendance-devices/:id",
  attendanceDeviceController.remove,
);

// ---------- Item jadwal (P, S, AL, OFF, ...) ----------
ownerRouter.get("/owner/schedule-items", scheduleItemController.getAll);
ownerRouter.get("/owner/schedule-items/:id", scheduleItemController.get);
ownerRouter.post("/owner/schedule-items", scheduleItemController.create);
ownerRouter.put("/owner/schedule-items/:id", scheduleItemController.update);
ownerRouter.delete("/owner/schedule-items/:id", scheduleItemController.remove);

// ---------- Jadwal bulanan ----------
ownerRouter.get("/owner/schedules", scheduleController.getAll);
ownerRouter.get("/owner/schedules/:id", scheduleController.get);
ownerRouter.post("/owner/schedules", scheduleController.create);
ownerRouter.put("/owner/schedules/:id", scheduleController.update);
ownerRouter.delete("/owner/schedules/:id", scheduleController.remove);

// Isi sel jadwal
ownerRouter.put(
  "/owner/schedules/:id/entries",
  scheduleController.upsertEntries,
);

// Karyawan di dalam jadwal
ownerRouter.post(
  "/owner/schedules/:id/employees",
  scheduleController.addEmployees,
);
ownerRouter.put(
  "/owner/schedules/:id/employees/order",
  scheduleController.reorderEmployees,
);
ownerRouter.delete(
  "/owner/schedules/:id/employees/:employeeId",
  scheduleController.removeEmployee,
);

ownerRouter.put(
  "/owner/attendances/:id/check-in",
  attendanceController.fixCheckin,
);
export default ownerRouter;
