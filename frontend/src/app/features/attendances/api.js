import api, { apiServer } from "../../../lib/api/client.js";

/**
 * GET /public/my-ip
 * Harus langsung ke backend (bukan lewat proxy "/api"), supaya yang terbaca
 * adalah IP publik wifi toko, bukan IP server Next.js.
 * `baseURL` ditimpa per-request; `withCredentials: false` karena endpoint publik.
 * Mengembalikan { ip, suggested_cidr } (isi `data` kalau dibungkus).
 */
export async function getMyIp() {
  const response = await apiServer.get("/public/my-ip", {
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: false,
  });

  return response.data?.data ?? response.data;
}

/* ---------- Jaringan wifi (OWNER) ---------- */

export async function getAttendanceNetworks() {
  const response = await api.get("/owner/attendance-networks");

  return response.data.data;
}

export async function createAttendanceNetwork({ label, cidr }) {
  const response = await api.post("/owner/attendance-networks", {
    label,
    cidr,
  });

  return response.data.data;
}

/** Minimal satu dari: label, cidr, is_active. */
export async function updateAttendanceNetwork(id, { label, cidr, is_active }) {
  const body = {
    ...(label !== undefined && { label }),
    ...(cidr !== undefined && { cidr }),
    ...(is_active !== undefined && { is_active }),
  };

  const response = await api.put(`/owner/attendance-networks/${id}`, body);

  return response.data.data;
}

export async function deleteAttendanceNetwork(id) {
  const response = await api.delete(`/owner/attendance-networks/${id}`);

  return response.data.data;
}

/* ---------- Pengaturan absen (OWNER) ---------- */

export async function getAttendanceSettings() {
  const response = await api.get("/owner/attendance-settings");

  return response.data.data;
}

export async function updateAttendanceSettings({ require_network }) {
  const response = await api.put("/owner/attendance-settings", {
    require_network,
  });

  return response.data.data;
}

/* ---------- Rekap absen (OWNER) ---------- */

const hasValue = (value) => value !== "" && value != null;

/**
 * GET /owner/attendances
 * employee_id (UUID), date_from & date_to (YYYY-MM-DD, WIB), page.
 * 50 per halaman, terbaru dulu. Mengembalikan { data, paging }.
 */
export async function getAttendances({
  employee_id,
  date_from,
  date_to,
  page = 1,
} = {}) {
  const params = {
    ...(employee_id && { employee_id }),
    ...(hasValue(date_from) && { date_from }),
    ...(hasValue(date_to) && { date_to }),
    page,
  };

  const response = await api.get("/owner/attendances", { params });

  return response.data;
}

/**
 * PATCH /owner/attendances/:id
 * check_out_at: string ISO 8601 untuk mengisi/memperbaiki jam pulang,
 * atau null untuk membuka kembali sesi. Harus dikirim secara eksplisit.
 * Mengembalikan objek rekap.
 */
export async function updateAttendance(id, { check_out_at }) {
  const response = await api.patch(`/owner/attendances/${id}`, {
    check_out_at,
  });

  return response.data.data;
}
/**
 * Ambil SEMUA catatan absen yang cocok filter (untuk export).
 * Loop per halaman sampai habis, lalu gabungkan.
 * @param {{ employee_id?: string, date_from?: string, date_to?: string }} filters
 * @returns {Promise<Array>}
 */
export async function getAttendancesForExport(filters = {}) {
  const PER_PAGE = 100;
  const all = [];
  let page = 1;

  // Batas pengaman agar tidak infinite loop.
  for (let guard = 0; guard < 200; guard += 1) {
    const response = await getAttendances({
      ...filters,
      page,
      per_page: PER_PAGE,
    });

    const data = response?.data ?? [];
    all.push(...data);

    const totalPages = response?.paging?.total_pages ?? 1;
    if (page >= totalPages || data.length === 0) break;

    page += 1;
  }

  return all;
}
/** GET /owner/attendance-devices */
export async function getAttendanceDevices() {
  const response = await api.get("/owner/attendance-devices");
  return response.data.data;
}

/** POST /owner/attendance-devices. Respons memuat `token` yang hanya muncul sekali. */
export async function createAttendanceDevice(data) {
  const response = await api.post("/owner/attendance-devices", data);
  return response.data.data;
}

/** PUT /owner/attendance-devices/:id (label dan/atau is_active) */
export async function updateAttendanceDevice(id, data) {
  const response = await api.put(`/owner/attendance-devices/${id}`, data);
  return response.data.data;
}

/** DELETE /owner/attendance-devices/:id (mencabut token permanen) */
export async function deleteAttendanceDevice(id) {
  const response = await api.delete(`/owner/attendance-devices/${id}`);
  return response.data.data;
}
/**
 * PUT /owner/attendances/:id/check-in
 * check_in_at: string ISO 8601 (wajib). Mengembalikan objek rekap.
 */
export async function updateAttendanceCheckIn(id, { check_in_at }) {
  const response = await api.put(`/owner/attendances/${id}/check-in`, {
    check_in_at,
  });

  return response.data.data;
}
