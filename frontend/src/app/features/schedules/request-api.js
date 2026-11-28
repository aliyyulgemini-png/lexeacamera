import api from "../../../lib/api/client.js";

const clean = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== "" && value !== null && value !== undefined,
    ),
  );

/* ---------------------------- Owner: form request ------------------------- */

export async function getRequestForms(params) {
  const response = await api.get("/owner/schedule-request-forms", {
    params: clean(params),
  });
  return response.data.data;
}

/** Detail form + tabel (dates, allowed_items, rows) */
export async function getRequestForm(id) {
  const response = await api.get(`/owner/schedule-request-forms/${id}`);
  return response.data.data;
}

/** Wajib memuat month dan employee_ids (baris tabel). */
export async function createRequestForm(data) {
  const response = await api.post("/owner/schedule-request-forms", data);
  return response.data.data;
}

export async function updateRequestForm(id, data) {
  const response = await api.put(`/owner/schedule-request-forms/${id}`, data);
  return response.data.data;
}

export async function deleteRequestForm(id) {
  const response = await api.delete(`/owner/schedule-request-forms/${id}`);
  return response.data.data;
}

export async function getFormRequests(id, params) {
  const response = await api.get(
    `/owner/schedule-request-forms/${id}/requests`,
    {
      params: clean(params),
    },
  );
  return response.data.data;
}

/** { request_ids: [...], status: "APPROVED" | "REJECTED", owner_note? } */
export async function reviewScheduleRequests(data) {
  const response = await api.put("/owner/schedule-requests/review", data);
  return response.data.data;
}

/* ------------------------------- Admin ----------------------------------- */

export async function getAdminSchedules(params) {
  const response = await api.get("/admin/schedules", { params: clean(params) });
  return response.data.data;
}

export async function getAdminSchedule(id) {
  const response = await api.get(`/admin/schedules/${id}`);
  return response.data.data;
}

export async function getAdminRequestForms() {
  const response = await api.get("/admin/schedule-request-forms");
  return response.data.data;
}

/** Tabel form: dates, allowed_items, rows, my_employee_id */
export async function getAdminRequestForm(id) {
  const response = await api.get(`/admin/schedule-request-forms/${id}`);
  return response.data.data;
}

/** entries: [{ employee_id, date, schedule_item_id | null }] (maks 5000) */
export async function saveAdminFormEntries(id, entries) {
  const response = await api.put(
    `/admin/schedule-request-forms/${id}/entries`,
    {
      entries,
    },
  );
  return response.data.data;
}

/** Opsional: kirim 1 request. employee_id boleh kosong. */
export async function createAdminRequest(data) {
  const response = await api.post("/admin/schedule-requests", data);
  return response.data.data;
}

/** Ubah 1 request PENDING (alasan atau kode). */
export async function updateAdminRequest(id, data) {
  const response = await api.put(`/admin/schedule-requests/${id}`, data);
  return response.data.data;
}

export async function deleteAdminRequest(id) {
  const response = await api.delete(`/admin/schedule-requests/${id}`);
  return response.data.data;
}
