"use client";

import { useEffect, useMemo, useState } from "react";
import { FiEdit2, FiPlus, FiSearch, FiX } from "react-icons/fi";

import {
  useGetScheduleEmployeeOptions,
  useGetScheduleItems,
} from "../../app/features/schedules/hooks.js";
import { toLocalInput } from "./schedule-request-shared.jsx";
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  DialogHeader,
  ErrorText,
  FOCUS_RING,
  FormError,
  ItemChip,
  MONTH_RE,
  Modal,
  Spinner,
  Tag,
  formatMonth,
  inputClass,
  labelClass,
} from "./schedule-shared.jsx";

const sameIds = (a, b) => {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
};

const sameOrder = (a, b) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * form: data form (ubah) atau null (buat baru)
 * extra: elemen tambahan di bawah pesan error (mis. link ke form yang sudah ada)
 */
export default function RequestFormDialog({
  form,
  month: initialMonth = "",
  busy,
  error,
  extra = null,
  onClose,
  onSubmit,
}) {
  const isEdit = Boolean(form);

  const itemsQuery = useGetScheduleItems({ is_active: "true" });
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);

  const employeesQuery = useGetScheduleEmployeeOptions(true);
  const employees = useMemo(
    () => employeesQuery.data ?? [],
    [employeesQuery.data],
  );

  const [month, setMonth] = useState(form?.month ?? initialMonth);
  const [title, setTitle] = useState(form?.title ?? "");
  const [description, setDescription] = useState(form?.description ?? "");
  const [maxDays, setMaxDays] = useState(
    form?.max_days_per_employee != null
      ? String(form.max_days_per_employee)
      : "",
  );
  const [closesAt, setClosesAt] = useState(
    form?.closes_at ? toLocalInput(form.closes_at) : "",
  );
  const [selected, setSelected] = useState(() => new Set());
  const [initialized, setInitialized] = useState(false);
  const [dropped, setDropped] = useState(0);

  // Karyawan: ubah = mulai dari isi form, buat = semua tercentang setelah dimuat.
  const [empSelected, setEmpSelected] = useState(
    () => new Set(form?.employee_ids ?? []),
  );
  const [empInitialized, setEmpInitialized] = useState(isEdit);
  const [search, setSearch] = useState("");
  const [errors, setErrors] = useState({});

  // Pilihan item awal: hanya item yang masih aktif (backend menolak yang nonaktif).
  useEffect(() => {
    if (initialized || !itemsQuery.data) return;

    if (form) {
      const activeIds = new Set(items.map((item) => item.id));
      const saved = form.allowed_item_ids ?? [];
      const kept = saved.filter((id) => activeIds.has(id));

      setSelected(new Set(kept));
      setDropped(saved.length - kept.length);
    }

    setInitialized(true);
  }, [form, initialized, items, itemsQuery.data]);

  useEffect(() => {
    if (empInitialized || employees.length === 0) return;
    setEmpSelected(new Set(employees.map((employee) => employee.id)));
    setEmpInitialized(true);
  }, [empInitialized, employees]);

  const visibleEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) =>
      String(employee.name ?? "")
        .toLowerCase()
        .includes(term),
    );
  }, [employees, search]);

  function clear(field) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleEmployee(id) {
    setEmpSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    clear("employees");
  }

  function setVisibleEmployees(checked) {
    setEmpSelected((current) => {
      const next = new Set(current);
      for (const employee of visibleEmployees) {
        if (checked) next.add(employee.id);
        else next.delete(employee.id);
      }
      return next;
    });
    clear("employees");
  }

  // Urutan baris: ubah = urutan lama dulu, lalu yang baru; buat = urutan daftar karyawan.
  function orderedEmployeeIds() {
    const inForm = new Set(form?.employee_ids ?? []);

    return [
      ...(form?.employee_ids ?? []).filter((id) => empSelected.has(id)),
      ...employees
        .filter(
          (employee) =>
            empSelected.has(employee.id) && !inForm.has(employee.id),
        )
        .map((employee) => employee.id),
    ];
  }

  function handleSubmit(event) {
    event.preventDefault();

    const found = {};
    const employeeIds = orderedEmployeeIds();

    if (!isEdit && !MONTH_RE.test(month)) {
      found.month = "Isi bulan dengan format YYYY-MM.";
    }
    if (title.trim().length > 150) found.title = "Judul maksimal 150 karakter.";
    if (
      maxDays !== "" &&
      (!/^\d+$/.test(maxDays) || Number(maxDays) < 1 || Number(maxDays) > 31)
    ) {
      found.maxDays =
        "Isi angka 1 sampai 31, atau kosongkan untuk tanpa batas.";
    }
    if (closesAt && Number.isNaN(new Date(closesAt).getTime())) {
      found.closesAt = "Batas waktu tidak valid.";
    }
    if (employeeIds.length === 0) found.employees = "Pilih minimal 1 karyawan.";

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const nextMax = maxDays === "" ? null : Number(maxDays);
    const nextClose = closesAt ? new Date(closesAt).toISOString() : null;
    const nextIds = [...selected];

    if (!isEdit) {
      onSubmit({
        month,
        employee_ids: employeeIds,
        ...(title.trim() && { title: title.trim() }),
        ...(description.trim() && { description: description.trim() }),
        ...(nextMax !== null && { max_days_per_employee: nextMax }),
        allowed_item_ids: nextIds,
        ...(nextClose && { closes_at: nextClose }),
      });
      return;
    }

    // Ubah: kirim hanya yang berubah.
    const changed = {};

    if (title.trim() && title.trim() !== (form.title ?? "")) {
      changed.title = title.trim();
    }
    if ((description.trim() || null) !== (form.description ?? null)) {
      changed.description = description.trim() || null;
    }
    if (nextMax !== (form.max_days_per_employee ?? null)) {
      changed.max_days_per_employee = nextMax;
    }
    if (!sameIds(nextIds, form.allowed_item_ids ?? [])) {
      changed.allowed_item_ids = nextIds;
    }
    if (!sameOrder(employeeIds, form.employee_ids ?? [])) {
      changed.employee_ids = employeeIds;
    }

    const previousClose = form.closes_at
      ? new Date(form.closes_at).getTime()
      : null;
    const nextCloseTime = nextClose ? new Date(nextClose).getTime() : null;
    if (previousClose !== nextCloseTime) changed.closes_at = nextClose;

    if (Object.keys(changed).length === 0) {
      onClose();
      return;
    }

    onSubmit(changed);
  }

  return (
    <Modal titleId="request-form-title" onClose={onClose} busy={busy} wide>
      <form onSubmit={handleSubmit} noValidate>
        <DialogHeader
          icon={isEdit ? FiEdit2 : FiPlus}
          onClose={onClose}
          busy={busy}
        />

        <h2
          id="request-form-title"
          className="mt-4 text-lg font-bold text-second"
        >
          {isEdit ? "Ubah form request" : "Buka form request"}
        </h2>
        <p className="mt-2 text-sm text-second/60">
          Form tampil di akun admin sebagai tabel semua karyawan dan tanggal.
          Admin mengisi OFF atau cuti langsung di sel.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <div className="min-w-0">
            <label htmlFor="rf-month" className={labelClass}>
              Bulan
              {!isEdit && (
                <span className="ml-2 text-second2" aria-hidden="true">
                  *
                </span>
              )}
            </label>
            <input
              id="rf-month"
              type="month"
              value={month}
              disabled={busy || isEdit}
              placeholder="2026-12"
              onChange={(event) => {
                setMonth(event.target.value);
                clear("month");
              }}
              aria-invalid={errors.month ? "true" : undefined}
              className={`${inputClass(Boolean(errors.month))} tabular-nums`}
            />
            {errors.month ? (
              <ErrorText>{errors.month}</ErrorText>
            ) : (
              isEdit && (
                <p className="mt-2 text-xs text-second/60">
                  Bulan tidak bisa diubah ({formatMonth(form.month)}).
                </p>
              )
            )}
          </div>

          <div className="min-w-0">
            <label htmlFor="rf-title" className={labelClass}>
              Judul
              <span className="ml-2 text-xs font-normal text-second/50">
                Opsional
              </span>
            </label>
            <input
              id="rf-title"
              value={title}
              maxLength={150}
              disabled={busy}
              autoComplete="off"
              placeholder={`REQUEST SCHEDULE ${formatMonth(month).toUpperCase()}`}
              onChange={(event) => {
                setTitle(event.target.value);
                clear("title");
              }}
              className={inputClass(Boolean(errors.title))}
            />
            {errors.title && <ErrorText>{errors.title}</ErrorText>}
          </div>

          <div className="min-w-0">
            <label htmlFor="rf-description" className={labelClass}>
              Keterangan
              <span className="ml-2 text-xs font-normal text-second/50">
                Opsional
              </span>
            </label>
            <textarea
              id="rf-description"
              rows={3}
              value={description}
              disabled={busy}
              placeholder="Contoh: Maksimal 3 hari, prioritas yang request duluan."
              onChange={(event) => setDescription(event.target.value)}
              className={inputClass(false)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="rf-max" className={labelClass}>
                Kuota hari per karyawan
                <span className="ml-2 text-xs font-normal text-second/50">
                  Opsional
                </span>
              </label>
              <input
                id="rf-max"
                inputMode="numeric"
                value={maxDays}
                disabled={busy}
                autoComplete="off"
                placeholder="Tanpa batas"
                onChange={(event) => {
                  setMaxDays(event.target.value.replace(/\D/g, "").slice(0, 2));
                  clear("maxDays");
                }}
                aria-invalid={errors.maxDays ? "true" : undefined}
                className={`${inputClass(Boolean(errors.maxDays))} tabular-nums`}
              />
              {errors.maxDays ? (
                <ErrorText>{errors.maxDays}</ErrorText>
              ) : (
                <p className="mt-2 text-xs text-second/60">
                  Yang dihitung: request menunggu dan disetujui.
                </p>
              )}
            </div>

            <div className="min-w-0">
              <label htmlFor="rf-closes" className={labelClass}>
                Batas waktu pengisian
                <span className="ml-2 text-xs font-normal text-second/50">
                  Opsional
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="rf-closes"
                  type="datetime-local"
                  value={closesAt}
                  disabled={busy}
                  onChange={(event) => {
                    setClosesAt(event.target.value);
                    clear("closesAt");
                  }}
                  aria-invalid={errors.closesAt ? "true" : undefined}
                  className={`${inputClass(Boolean(errors.closesAt))} tabular-nums`}
                />
                {closesAt && (
                  <button
                    type="button"
                    onClick={() => setClosesAt("")}
                    disabled={busy}
                    aria-label="Hapus batas waktu"
                    className={`inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-second/60 transition-colors hover:bg-second/10 hover:text-second ${FOCUS_RING}`}
                  >
                    <FiX size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              {errors.closesAt ? (
                <ErrorText>{errors.closesAt}</ErrorText>
              ) : (
                <p className="mt-2 text-xs text-second/60">
                  Kosong = terbuka sampai ditutup manual. Mengikuti zona waktu
                  perangkat Anda.
                </p>
              )}
            </div>
          </div>

          {/* Karyawan */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={`${labelClass} !mb-0`}>
                Karyawan di tabel
                <span className="ml-2 text-second2" aria-hidden="true">
                  *
                </span>
              </p>
              <Tag tone="soft">
                {empSelected.size}/{employees.length || empSelected.size}{" "}
                dipilih
              </Tag>
            </div>

            <div className="relative mt-2">
              <FiSearch
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
              />
              <input
                type="search"
                aria-label="Cari karyawan"
                value={search}
                disabled={busy}
                autoComplete="off"
                placeholder="Cari karyawan…"
                onChange={(event) => setSearch(event.target.value)}
                className={`${inputClass(false)} pl-8`}
              />
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setVisibleEmployees(true)}
                disabled={busy || visibleEmployees.length === 0}
                className={`${BTN_OUTLINE} !px-2 !py-1 text-xs`}
              >
                Pilih semua
              </button>
              <button
                type="button"
                onClick={() => setVisibleEmployees(false)}
                disabled={busy || visibleEmployees.length === 0}
                className={`${BTN_OUTLINE} !px-2 !py-1 text-xs`}
              >
                Kosongkan
              </button>
            </div>

            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-second/30">
              {employeesQuery.isPending ? (
                <p role="status" className="p-4 text-sm text-second/60">
                  Memuat karyawan…
                </p>
              ) : employeesQuery.isError && !employeesQuery.data ? (
                <div className="flex flex-wrap items-center gap-2 p-4">
                  <p role="alert" className="text-sm text-second2">
                    Gagal memuat karyawan.
                  </p>
                  <button
                    type="button"
                    onClick={() => employeesQuery.refetch()}
                    className={BTN_OUTLINE}
                  >
                    Coba lagi
                  </button>
                </div>
              ) : visibleEmployees.length === 0 ? (
                <p className="p-4 text-sm text-second/60">
                  {employees.length === 0
                    ? "Belum ada karyawan."
                    : "Tidak ada karyawan yang cocok."}
                </p>
              ) : (
                <ul className="divide-y divide-second/10">
                  {visibleEmployees.map((employee) => (
                    <li key={employee.id}>
                      <label className="flex cursor-pointer items-center gap-4 p-4 hover:bg-second/5">
                        <input
                          type="checkbox"
                          checked={empSelected.has(employee.id)}
                          disabled={busy}
                          onChange={() => toggleEmployee(employee.id)}
                          className={`size-4 shrink-0 cursor-pointer accent-second4 ${FOCUS_RING}`}
                        />
                        <span className="min-w-0 break-words text-sm font-semibold text-second">
                          {employee.name}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {errors.employees ? (
              <ErrorText>{errors.employees}</ErrorText>
            ) : (
              <p className="mt-2 text-xs text-second/60">
                {isEdit
                  ? "Request milik karyawan yang dikeluarkan tetap tersimpan, hanya tidak tampil di tabel."
                  : "Karyawan yang dipilih menjadi baris tabel form."}
              </p>
            )}
          </div>

          {/* Item */}
          <div className="min-w-0">
            <p className={labelClass}>Item yang boleh dipilih</p>

            {itemsQuery.isPending ? (
              <p role="status" className="text-sm text-second/60">
                Memuat item…
              </p>
            ) : itemsQuery.isError && !itemsQuery.data ? (
              <p role="alert" className="text-sm text-second2">
                Gagal memuat item. Tutup dialog lalu coba lagi.
              </p>
            ) : items.length === 0 ? (
              <p className="text-sm text-second/60">
                Belum ada item aktif. Tambahkan di halaman item jadwal.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {items.map((item) => {
                  const isOn = selected.has(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggle(item.id)}
                      disabled={busy}
                      aria-pressed={isOn}
                      title={item.name}
                      className={`flex items-center gap-2 rounded-xl border p-2 text-xs transition disabled:opacity-50 ${FOCUS_RING} ${
                        isOn
                          ? "border-second4 bg-second4/5"
                          : "border-second/30 hover:border-second4"
                      }`}
                    >
                      <ItemChip item={item} />
                      <span className="max-w-32 truncate text-second">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <p className="mt-2 text-xs text-second/60">
              {selected.size === 0
                ? "Tidak ada yang dipilih: semua item aktif boleh dipakai."
                : `${selected.size} item dipilih.`}
            </p>

            {dropped > 0 && (
              <p className="mt-2 text-xs text-second4">
                {dropped} item pilihan sebelumnya sudah nonaktif dan tidak
                dimasukkan lagi.
              </p>
            )}
          </div>

          {error && <FormError>{error}</FormError>}
          {extra}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-2 border-t border-second/30 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`${BTN_OUTLINE} w-full sm:w-auto`}
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={
              busy || !initialized || (!isEdit && employeesQuery.isPending)
            }
            aria-busy={busy}
            className={`${BTN_PRIMARY} w-full sm:w-auto`}
          >
            {busy ? (
              <>
                <Spinner />
                Menyimpan…
              </>
            ) : isEdit ? (
              "Simpan"
            ) : (
              "Buka form"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
