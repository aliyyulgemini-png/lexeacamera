import api from "../../../lib/api/client.js";

const clean = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== "" && value !== null && value !== undefined,
    ),
  );

/* --------------------------------- Item ---------------------------------- */

export async function getScheduleItems(params) {
  const response = await api.get("/owner/schedule-items", {
    params: clean(params),
  });
  return response.data.data;
}

export async function createScheduleItem(data) {
  const response = await api.post("/owner/schedule-items", data);
  return response.data.data;
}

export async function updateScheduleItem(id, data) {
  const response = await api.put(`/owner/schedule-items/${id}`, data);
  return response.data.data;
}

export async function deleteScheduleItem(id) {
  const response = await api.delete(`/owner/schedule-items/${id}`);
  return response.data.data;
}

/* -------------------------------- Jadwal --------------------------------- */

export async function getSchedules(params) {
  const response = await api.get("/owner/schedules", { params: clean(params) });
  return response.data.data;
}

export async function getSchedule(id) {
  const response = await api.get(`/owner/schedules/${id}`);
  return response.data.data;
}

export async function createSchedule(data) {
  const response = await api.post("/owner/schedules", data);
  return response.data.data;
}

export async function updateSchedule(id, data) {
  const response = await api.put(`/owner/schedules/${id}`, data);
  return response.data.data;
}

export async function deleteSchedule(id) {
  const response = await api.delete(`/owner/schedules/${id}`);
  return response.data.data;
}

/** entries: [{ employee_id, date, schedule_item_id | null }] (maks 5000) */
export async function saveScheduleEntries(id, entries) {
  const response = await api.put(`/owner/schedules/${id}/entries`, { entries });
  return response.data.data;
}

export async function addScheduleEmployees(id, employeeIds) {
  const response = await api.post(`/owner/schedules/${id}/employees`, {
    employee_ids: employeeIds,
  });
  return response.data.data;
}

export async function removeScheduleEmployee(id, employeeId) {
  const response = await api.delete(
    `/owner/schedules/${id}/employees/${employeeId}`,
  );
  return response.data.data;
}

export async function reorderScheduleEmployees(id, employeeIds) {
  const response = await api.put(`/owner/schedules/${id}/employees/order`, {
    employee_ids: employeeIds,
  });
  return response.data.data;
}

/* ------------------------------- Karyawan -------------------------------- */

// ASUMSI: GET /owner/employees mengembalikan { data: [...], paging } atau array.
// Sesuaikan bila bentuk respons atau parameter halamannya beda.
export async function getAllEmployees() {
  const all = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await api.get("/owner/employees", { params: { page } });
    const body = response.data;

    const rows = Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.data?.data)
        ? body.data.data
        : Array.isArray(body)
          ? body
          : [];

    all.push(...rows);
    totalPages = body?.paging?.total_pages ?? 1;
    page += 1;
  } while (page <= totalPages && page <= 20);

  const seen = new Set();
  return all.filter((employee) => {
    if (!employee?.id || seen.has(employee.id)) return false;
    seen.add(employee.id);
    return true;
  });
}
