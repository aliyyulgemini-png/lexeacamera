// =====================================================================
// Konfigurasi yang menghubungkan fitur jadwal dengan tabel karyawan
// yang SUDAH ADA di project kamu. Cukup ubah file ini.
// =====================================================================

// Field karyawan yang ikut dikirim di response detail jadwal.
// Ganti sesuai kolom di tabel karyawan kamu (mis. nik, employee_code, position).
export const EMPLOYEE_SELECT = {
  id: true,
  name: true,
  // employee_code: true,
};

// Nama bulan untuk judul otomatis ("SCHEDULE DESEMBER 2026")
export const MONTH_NAMES = [
  "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
  "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER",
];
