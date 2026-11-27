"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiEdit2,
  FiLoader,
  FiLogIn,
  FiLogOut,
  FiRefreshCw,
  FiRotateCcw,
  FiSettings,
  FiUsers,
  FiX,
} from "react-icons/fi";

import {
  useGetAttendances,
  useUpdateAttendance,
  useUpdateAttendanceCheckIn,
} from "../../../features/attendances/hooks.js";
import notify from "../../../../lib/notify.js";
import { normalizeApiError } from "../../../../lib/api/errors.js";
import ExportAttendancesButton from "../../../../components/owner/export-attendance-button.jsx";
import PrimaryButton from "../../../../components/primary-button.jsx";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const SETTINGS_PATH = "/owner/attendances/settings";
const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const labelClass = "mb-2 block text-sm font-semibold text-second";

function inputClass(hasError) {
  return [
    "w-full min-w-0 rounded-xl border bg-primary px-4 py-2 text-base text-second",
    "placeholder:text-second/35 transition-colors duration-150",
    "outline-none focus:ring-4",
    "disabled:cursor-not-allowed disabled:bg-second/5 disabled:text-second/50",
    hasError
      ? "border-second2 focus:border-second2 focus:ring-second2/15"
      : "border-second/30 hover:border-second/30 focus:border-second4 focus:ring-second4/15",
  ].join(" ");
}

const STATUS = {
  DONE: { label: "Selesai", tone: "blue", icon: FiCheckCircle },
  OPEN: { label: "Di toko", tone: "violet", icon: FiClock },
  MISSED: { label: "Lupa absen pulang", tone: "red", icon: FiAlertTriangle },
};

// PUT /owner/attendances/:id/check-out
const CHECKOUT_ERRORS = {
  CHECKOUT_BEFORE_CHECKIN: "Jam pulang harus sesudah jam masuk.",
  CHECKOUT_TOO_LATE: "Jam pulang paling lama 24 jam setelah jam masuk.",
  OVERLAPS_NEXT_ATTENDANCE:
    "Jam pulang melewati jam masuk sesi berikutnya milik karyawan ini.",
  ANOTHER_ATTENDANCE_OPEN:
    "Karyawan ini punya sesi lain yang masih terbuka, jadi sesi ini tidak bisa dibuka kembali.",
};

// PUT /owner/attendances/:id/check-in
const CHECKIN_ERRORS = {
  CHECKIN_IN_FUTURE: "Jam masuk tidak boleh di masa depan.",
  CHECKIN_AFTER_CHECKOUT: "Jam masuk harus sebelum jam pulang.",
  DURATION_TOO_LONG: "Jarak jam masuk ke jam pulang paling lama 24 jam.",
  OPEN_ATTENDANCE_DAY_CHANGE:
    "Sesi yang belum absen pulang tidak bisa dipindah ke hari lain. Isi jam pulang dulu, lalu ubah jam masuk.",
  OVERLAPS_PREVIOUS_ATTENDANCE:
    "Jam masuk bertabrakan dengan sesi sebelumnya milik karyawan ini.",
  OVERLAPS_NEXT_ATTENDANCE:
    "Jam masuk melewati jam masuk sesi berikutnya milik karyawan ini.",
  ANOTHER_ATTENDANCE_SAME_DAY:
    "Karyawan ini sudah punya absen lain di hari tersebut.",
};

/* -------------------------------- Formatters ------------------------------ */

function formatNumber(number = 0) {
  return new Intl.NumberFormat("id-ID").format(number);
}

function formatDay(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  })}`.replace(".", ":");
}

function formatDateTimeFull(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })} WIB`;
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} mnt`;
  if (rest === 0) return `${hours} jam`;
  return `${hours} jam ${rest} mnt`;
}

function toLocalInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Nomor hari menurut WIB (UTC+7), dipakai untuk membandingkan "hari yang sama".
function wibDayKey(ms) {
  return Math.floor((ms + WIB_OFFSET_MS) / DAY_MS);
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline", icon: Icon }) {
  const tones = {
    outline: "border border-second/30 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    solid: "bg-second text-primary",
    grad: "bg-grad text-primary",
    success: "bg-second3 text-primary",
    failure: "bg-second2 text-primary",
    pending: "bg-second4 text-primary",
    blue: "bg-second3/10 text-second3",
    violet: "bg-second4/10 text-second4",
    red: "bg-second2/10 text-second2",
    muted: "border border-second/30 text-second/65",
  };
  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

function StatusTag({ status }) {
  const config = STATUS[status] ?? { label: status ?? "—", tone: "muted" };
  return (
    <Tag tone={config.tone} icon={config.icon}>
      {config.label}
    </Tag>
  );
}

function StatCard({ icon: Icon, label, value, hint, featured = false }) {
  return (
    <article
      className={`flex min-w-0 flex-col gap-4 rounded-2xl p-4 sm:p-8 ${
        featured
          ? "bg-grad text-primary shadow-lg shadow-second4/25"
          : "border border-second/30 bg-primary text-second shadow-xl shadow-second/5"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
            featured
              ? "bg-primary text-second"
              : "bg-grad text-primary shadow-lg shadow-second4/25"
          }`}
        >
          <Icon size={16} aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold">{label}</h3>
      </div>
      <div className="min-w-0">
        <p className="break-words text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
          {value}
        </p>
        {hint && (
          <p
            className={`mt-2 text-xs tabular-nums ${featured ? "text-primary/90" : "text-second/60"}`}
          >
            {hint}
          </p>
        )}
      </div>
    </article>
  );
}

function Field({ id, label, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

function RecordActions({ record, onEdit }) {
  const checkOutLabel =
    record.status === "DONE" ? "Ubah jam pulang" : "Isi jam pulang";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onEdit(record, "check-in")}
        className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
      >
        <FiLogIn size={16} aria-hidden="true" />
        Ubah jam masuk
      </button>
      <PrimaryButton
        type="button"
        onClick={() => onEdit(record, "check-out")}
        fullWidth
      >
        <FiEdit2 size={16} aria-hidden="true" />
        {checkOutLabel}
      </PrimaryButton>
    </div>
  );
}

/* -------------------------------- Skeleton ------------------------------- */

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="size-8 shrink-0 animate-pulse rounded-xl bg-second/10" />
          <div className="min-w-0 space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-second/10" />
            <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
          </div>
        </div>
        <div className="h-8 w-40 animate-pulse rounded-xl bg-second/10" />
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl bg-second/10"
          />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-2xl bg-second/10" />
      <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
    </div>
  );
}

/* ------------------------------- Edit Dialog ----------------------------- */

function EditDialog({
  record,
  mode,
  busy,
  apiError,
  onClose,
  onSave,
  onReopen,
}) {
  const isCheckIn = mode === "check-in";

  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [value, setValue] = useState(() => {
    if (isCheckIn) return toLocalInput(record.check_in_at);
    return record.check_out_at ? toLocalInput(record.check_out_at) : "";
  });
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const checkInTime = new Date(record.check_in_at).getTime();
  const checkOutTime = record.check_out_at
    ? new Date(record.check_out_at).getTime()
    : null;

  // Batas input datetime-local
  let minValue;
  let maxValue;
  if (isCheckIn) {
    minValue =
      checkOutTime !== null
        ? toLocalInput(new Date(checkOutTime - DAY_MS))
        : undefined;
    maxValue = toLocalInput(
      new Date(
        checkOutTime !== null ? Math.min(Date.now(), checkOutTime) : Date.now(),
      ),
    );
  } else {
    minValue = toLocalInput(record.check_in_at);
    maxValue = toLocalInput(
      new Date(Math.min(Date.now(), checkInTime + DAY_MS)),
    );
  }

  function validateCheckOut(date) {
    if (date.getTime() > Date.now()) {
      return "Jam pulang tidak boleh di masa depan.";
    }
    if (date.getTime() <= checkInTime) {
      return CHECKOUT_ERRORS.CHECKOUT_BEFORE_CHECKIN;
    }
    if (date.getTime() > checkInTime + DAY_MS) {
      return CHECKOUT_ERRORS.CHECKOUT_TOO_LATE;
    }
    return "";
  }

  function validateCheckIn(date) {
    const time = date.getTime();

    if (value === toLocalInput(record.check_in_at)) {
      return "Jam masuk belum diubah.";
    }
    if (time > Date.now()) {
      return CHECKIN_ERRORS.CHECKIN_IN_FUTURE;
    }
    if (checkOutTime !== null) {
      if (time >= checkOutTime) return CHECKIN_ERRORS.CHECKIN_AFTER_CHECKOUT;
      if (checkOutTime - time > DAY_MS) return CHECKIN_ERRORS.DURATION_TOO_LONG;
    } else if (wibDayKey(time) !== wibDayKey(checkInTime)) {
      return CHECKIN_ERRORS.OPEN_ATTENDANCE_DAY_CHANGE;
    }
    return "";
  }

  function handleSubmit(event) {
    event.preventDefault();
    setLocalError("");

    if (!value) {
      setLocalError(
        isCheckIn
          ? "Pilih jam masuk terlebih dahulu."
          : "Pilih jam pulang terlebih dahulu.",
      );
      return;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      setLocalError(
        isCheckIn ? "Jam masuk tidak valid." : "Jam pulang tidak valid.",
      );
      return;
    }

    const message = isCheckIn ? validateCheckIn(date) : validateCheckOut(date);
    if (message) {
      setLocalError(message);
      return;
    }

    onSave(date.toISOString());
  }

  const shownError = localError || apiError;

  const title = isCheckIn
    ? "Ubah jam masuk"
    : record.check_out_at
      ? "Ubah jam pulang"
      : "Isi jam pulang";

  const inputLabel = isCheckIn ? "Jam masuk" : "Jam pulang";
  const HeaderIcon = isCheckIn ? FiLogIn : FiLogOut;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={busy ? undefined : onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-attendance-title"
        onSubmit={handleSubmit}
        noValidate
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-second/30 bg-primary p-4 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20">
            <HeaderIcon size={16} aria-hidden="true" />
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup dialog"
            className={`flex size-8 items-center justify-center rounded-xl text-second/60 transition-colors hover:bg-second/10 hover:text-second disabled:opacity-50 ${FOCUS_RING}`}
          >
            <FiX size={16} aria-hidden="true" />
          </button>
        </div>

        <h2
          id="edit-attendance-title"
          className="mt-4 text-lg font-bold text-second"
        >
          {title}
        </h2>

        <dl className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-second/[0.03] p-4 text-sm">
          <div className="min-w-0">
            <dt className="text-xs text-second/60">Karyawan</dt>
            <dd className="mt-2 truncate font-semibold text-second">
              {record.employee?.name ?? "—"}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-second/60">Status</dt>
            <dd className="mt-2">
              <StatusTag status={record.status} />
            </dd>
          </div>
          <div className="col-span-2 min-w-0">
            <dt className="text-xs text-second/60">
              {isCheckIn ? "Jam pulang" : "Jam masuk"}
            </dt>
            <dd className="mt-2 font-semibold tabular-nums text-second">
              {isCheckIn
                ? record.check_out_at
                  ? formatDateTimeFull(record.check_out_at)
                  : "Belum ada"
                : formatDateTimeFull(record.check_in_at)}
            </dd>
          </div>
          {isCheckIn && (
            <div className="col-span-2 min-w-0">
              <dt className="text-xs text-second/60">Jam masuk saat ini</dt>
              <dd className="mt-2 font-semibold tabular-nums text-second">
                {formatDateTimeFull(record.check_in_at)}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-4">
          <label htmlFor="edit-attendance-time" className={labelClass}>
            {inputLabel}
            <span className="ml-2 text-second2" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="edit-attendance-time"
            type="datetime-local"
            value={value}
            min={minValue}
            max={maxValue}
            disabled={busy}
            onChange={(event) => {
              setValue(event.target.value);
              setLocalError("");
            }}
            aria-invalid={shownError ? "true" : undefined}
            className={inputClass(Boolean(shownError))}
          />
          <p className="mt-2 text-xs leading-relaxed text-second/60">
            {isCheckIn
              ? "Tidak boleh di masa depan dan harus sebelum jam pulang (paling lama 24 jam sebelumnya). Tidak boleh bertabrakan dengan sesi lain milik karyawan ini. Sesi yang belum absen pulang hanya bisa dipindah di hari yang sama. Waktu mengikuti zona waktu perangkat Anda."
              : "Harus sesudah jam masuk, paling lama 24 jam sesudahnya, dan tidak boleh melewati jam masuk sesi berikutnya. Waktu mengikuti zona waktu perangkat Anda."}
          </p>
        </div>

        {shownError && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
          >
            <FiAlertTriangle
              size={16}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            {shownError}
          </p>
        )}

        {isCheckIn && record.check_out_at && (
          <p className="mt-4 rounded-xl border border-second/30 p-4 text-xs leading-relaxed text-second/60">
            <span className="font-semibold text-second">
              Menggeser seluruh shift?
            </span>{" "}
            Ke lebih siang: ubah jam pulang dulu, lalu jam masuk. Ke lebih pagi:
            ubah jam masuk dulu, lalu jam pulang.
          </p>
        )}

        {!isCheckIn && record.check_out_at && (
          <div className="mt-4 rounded-xl border border-second/30 p-4">
            <p className="text-sm font-semibold text-second">
              Salah menekan absen pulang?
            </p>
            <p className="mt-2 text-xs leading-relaxed text-second/60">
              Jam pulang dihapus dan sesi dibuka kembali. Kalau sesinya dari
              hari ini, karyawan bisa absen pulang lagi. Kalau dari hari
              sebelumnya, statusnya menjadi “Lupa absen pulang”.
            </p>
            <button
              type="button"
              onClick={onReopen}
              disabled={busy}
              className={`${BTN_BASE} mt-4 border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
            >
              <FiRotateCcw size={16} aria-hidden="true" />
              Buka kembali sesi
            </button>
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse gap-2 border-t border-second/30 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${FOCUS_RING}`}
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
          >
            {busy ? (
              <>
                <FiLoader
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                  aria-hidden="true"
                />
                Menyimpan…
              </>
            ) : isCheckIn ? (
              "Simpan jam masuk"
            ) : (
              "Simpan jam pulang"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function AttendancesPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [employees, setEmployees] = useState({});
  // { record, mode: "check-in" | "check-out" } atau null
  const [edit, setEdit] = useState(null);
  const [editError, setEditError] = useState("");

  const invalidRange = dateFrom !== "" && dateTo !== "" && dateFrom > dateTo;

  const query = useGetAttendances({
    employee_id: employeeId,
    date_from: invalidRange ? "" : dateFrom,
    date_to: invalidRange ? "" : dateTo,
    page: currentPage,
  });
  const { data, isPending, isError, isFetching, error, refetch } = query;

  const updateCheckOutMutation = useUpdateAttendance();
  const updateCheckInMutation = useUpdateAttendanceCheckIn();
  const isSaving =
    updateCheckOutMutation.isPending || updateCheckInMutation.isPending;

  useEffect(() => {
    if (!isError || !error) return;
    notify.error(normalizeApiError(error).message);
  }, [isError, error]);

  const records = data?.data ?? [];
  const paging = data?.paging;

  useEffect(() => {
    if (records.length === 0) return;

    setEmployees((current) => {
      let changed = false;
      const next = { ...current };

      for (const record of records) {
        const employee = record.employee;
        if (employee?.id && next[employee.id] !== employee.name) {
          next[employee.id] = employee.name;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [records]);

  const employeeOptions = useMemo(
    () =>
      Object.entries(employees)
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "id")),
    [employees],
  );

  const total = paging?.total ?? 0;
  const totalPages = Math.max(1, paging?.total_pages ?? 1);
  const safePage = paging?.page ?? currentPage;
  const perPage = paging?.per_page ?? records.length;
  const startItem = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const endItem = Math.min(safePage * perPage, total);

  const openCount = records.filter((r) => r.status === "OPEN").length;
  const missedCount = records.filter((r) => r.status === "MISSED").length;
  const doneRecords = records.filter(
    (r) => r.status === "DONE" && typeof r.duration_minutes === "number",
  );
  const averageMinutes =
    doneRecords.length > 0
      ? Math.round(
          doneRecords.reduce((sum, r) => sum + r.duration_minutes, 0) /
            doneRecords.length,
        )
      : null;

  const activeFilterCount = [employeeId, dateFrom, dateTo].filter(
    (value) => value !== "",
  ).length;
  const hasFilters = activeFilterCount > 0;

  function updateFilter(setter, value) {
    setter(value);
    setCurrentPage(1);
  }

  function resetFilters() {
    setEmployeeId("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }

  function openEdit(record, mode) {
    setEditError("");
    setEdit({ record, mode });
  }

  async function submitEdit({ mutation, payload, successMessage, errorMap }) {
    setEditError("");

    try {
      await mutation.mutateAsync({
        id: edit.record.id,
        data: payload,
      });
      notify.success(successMessage);
      setEdit(null);
    } catch (err) {
      const code = err?.response?.data?.errors;

      if (code === "ATTENDANCE_NOT_FOUND") {
        notify.error("Data absen tidak ditemukan.");
        setEdit(null);
        refetch();
        return;
      }

      setEditError(errorMap[code] ?? normalizeApiError(err).message);
    }
  }

  function saveCheckIn(iso) {
    return submitEdit({
      mutation: updateCheckInMutation,
      payload: { check_in_at: iso },
      successMessage: "Jam masuk disimpan.",
      errorMap: CHECKIN_ERRORS,
    });
  }

  function saveCheckOut(value, successMessage) {
    return submitEdit({
      mutation: updateCheckOutMutation,
      payload: { check_out_at: value },
      successMessage,
      errorMap: CHECKOUT_ERRORS,
    });
  }

  if (isPending) {
    return <LoadingState />;
  }

  if (isError && !data) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiUsers size={16} />
            </div>
            <div>
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Rekap <span className="text-grad">Absen</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                Pantau jam masuk dan pulang karyawan, serta perbaiki yang
                terlewat.
              </p>
            </div>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            Gagal memuat rekap absen
          </h2>
          <p className="mt-2 max-w-md text-sm text-second/60">
            Periksa koneksi atau filter Anda, lalu coba kembali.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className={`${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
              >
                Reset filter
              </button>
            )}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              <FiRefreshCw
                size={16}
                className={
                  isFetching ? "animate-spin motion-reduce:animate-none" : ""
                }
                aria-hidden="true"
              />
              {isFetching ? "Memuat…" : "Coba lagi"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiUsers size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Rekap <span className="text-grad">Absen</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Pantau jam masuk dan pulang karyawan, serta perbaiki yang
              terlewat.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link
            href={SETTINGS_PATH}
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 sm:w-auto ${FOCUS_RING}`}
          >
            <FiSettings size={16} aria-hidden="true" />
            Pengaturan Absen
          </Link>
          <ExportAttendancesButton
            employeeId={employeeId}
            dateFrom={invalidRange ? "" : dateFrom}
            dateTo={invalidRange ? "" : dateTo}
            disabled={isFetching || records.length === 0}
          />
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui data absen"
            className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={
                isFetching ? "animate-spin motion-reduce:animate-none" : ""
              }
              aria-hidden="true"
            />
            {isFetching ? "Memperbarui…" : "Perbarui"}
          </button>
        </div>
      </header>

      {isError && data && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2">
            <FiAlertTriangle size={16} aria-hidden="true" />
            Gagal memperbarui data. Menampilkan data terakhir.
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className={`${BTN_BASE} w-fit border border-second2/40 text-second2 hover:bg-second2/10 ${FOCUS_RING}`}
          >
            Coba lagi
          </button>
        </div>
      )}

      {missedCount > 0 && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
        >
          <FiAlertTriangle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          {missedCount} sesi di halaman ini lupa absen pulang. Gunakan tombol
          “Isi jam pulang” untuk memperbaikinya.
        </p>
      )}

      {/* Stat cards */}
      <section
        aria-label="Ringkasan absen"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          featured
          icon={FiUsers}
          label="Total catatan"
          value={formatNumber(total)}
          hint={hasFilters ? "Sesuai filter" : "Semua catatan"}
        />
        <StatCard
          icon={FiClock}
          label="Sedang di toko"
          value={formatNumber(openCount)}
          hint="Pada halaman ini"
        />
        <StatCard
          icon={FiAlertTriangle}
          label="Lupa absen pulang"
          value={formatNumber(missedCount)}
          hint="Pada halaman ini"
        />
        <StatCard
          icon={FiCheckCircle}
          label="Rata-rata durasi"
          value={formatDuration(averageMinutes)}
          hint="Sesi selesai di halaman ini"
        />
      </section>

      {/* Filter */}
      <section
        aria-label="Filter absen"
        className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
      >
        <div>
          <h2 className="text-lg font-bold text-second">Filter</h2>
          <p className="mt-2 text-pretty text-sm text-second/60">
            Persempit daftar absen berdasarkan karyawan atau rentang tanggal.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field id="att-employee" label="Karyawan">
            <select
              id="att-employee"
              value={employeeId}
              onChange={(event) =>
                updateFilter(setEmployeeId, event.target.value)
              }
              className={inputClass(false)}
            >
              <option value="">Semua karyawan</option>
              {employeeOptions.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </Field>

          <Field id="att-from" label="Dari tanggal">
            <input
              id="att-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) =>
                updateFilter(setDateFrom, event.target.value)
              }
              aria-invalid={invalidRange ? "true" : undefined}
              className={inputClass(invalidRange)}
            />
          </Field>

          <Field id="att-to" label="Sampai tanggal">
            <input
              id="att-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => updateFilter(setDateTo, event.target.value)}
              aria-invalid={invalidRange ? "true" : undefined}
              className={inputClass(invalidRange)}
            />
          </Field>
        </div>

        {invalidRange ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-xs text-second2"
          >
            <FiAlertTriangle
              size={14}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            Tanggal awal tidak boleh lebih besar dari tanggal akhir.
          </p>
        ) : (
          <p className="text-xs text-second/60">
            Tanggal memakai zona waktu WIB, dihitung dari waktu absen masuk, dan
            sudah termasuk tanggal awal dan akhir.
          </p>
        )}
      </section>

      {/* List header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Daftar absen</h2>
          <p
            className="mt-2 text-sm tabular-nums text-second/60"
            aria-live="polite"
          >
            Menampilkan {formatNumber(startItem)}–{formatNumber(endItem)} dari{" "}
            {formatNumber(total)} catatan
          </p>
        </div>
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="strong">{activeFilterCount} filter aktif</Tag>
            <button
              type="button"
              onClick={resetFilters}
              className={`${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
            >
              <FiX size={16} aria-hidden="true" />
              Reset
            </button>
          </div>
        )}
      </div>

      {/* List */}
      <div className="relative min-h-40">
        {isFetching && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-primary/75 pt-10 backdrop-blur-[2px]"
          >
            <div className="flex items-center gap-2 rounded-xl border border-second/30 bg-primary px-4 py-2 shadow-xl shadow-second/5">
              <FiLoader
                className="animate-spin motion-reduce:animate-none text-second4"
                size={16}
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-second">
                Memperbarui data…
              </span>
            </div>
          </div>
        )}

        {records.length > 0 ? (
          <div
            className={`transition-opacity duration-200 ${isFetching ? "opacity-40" : "opacity-100"}`}
          >
            {/* Tabel desktop */}
            <div className="hidden overflow-hidden rounded-2xl bg-primary shadow-xl shadow-second/5 lg:block">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-grad text-sm text-primary">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Karyawan
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Tanggal
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Masuk
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Pulang
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-semibold"
                      >
                        Durasi
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-semibold"
                      >
                        Aksi
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-second/10">
                    {records.map((record, i) => (
                      <tr
                        key={record.id}
                        className={`align-top transition-colors hover:bg-second/20 ${i % 2 === 0 ? "" : "bg-second3/20"}`}
                      >
                        <td className="px-4 py-4 text-sm font-semibold text-second">
                          {record.employee?.name ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm tabular-nums text-second/70">
                          {formatDay(record.check_in_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold tabular-nums text-second">
                          {formatTime(record.check_in_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold tabular-nums text-second">
                          {record.check_out_at ? (
                            formatTime(record.check_out_at)
                          ) : (
                            <span className="text-second/50">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-second/70">
                          {formatDuration(record.duration_minutes)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusTag status={record.status} />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <RecordActions record={record} onEdit={openEdit} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Card mobile */}
            <ul className="flex flex-col gap-4 lg:hidden">
              {records.map((record) => (
                <li key={record.id}>
                  <article className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 transition-colors hover:border-second4 hover:bg-second4/5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-second">
                          {record.employee?.name ?? "—"}
                        </p>
                        <p className="mt-2 text-xs tabular-nums text-second/60">
                          {formatDay(record.check_in_at)}
                        </p>
                      </div>
                      <StatusTag status={record.status} />
                    </div>

                    <dl className="grid grid-cols-3 gap-4 border-t border-second/30 pt-4 text-sm">
                      <div>
                        <dt className="text-xs text-second/60">Masuk</dt>
                        <dd className="mt-2 font-semibold tabular-nums text-second">
                          {formatTime(record.check_in_at)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-second/60">Pulang</dt>
                        <dd className="mt-2 font-semibold tabular-nums text-second">
                          {record.check_out_at
                            ? formatTime(record.check_out_at)
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-second/60">Durasi</dt>
                        <dd className="mt-2 font-semibold tabular-nums text-second">
                          {formatDuration(record.duration_minutes)}
                        </dd>
                      </div>
                    </dl>

                    <div>
                      <RecordActions record={record} onEdit={openEdit} />
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 bg-primary px-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-second/10 text-second">
              <FiUsers size={24} aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-second">
              {hasFilters ? "Absen tidak ditemukan" : "Belum ada catatan absen"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-second/60">
              {hasFilters
                ? "Tidak ada catatan yang sesuai dengan filter yang dipilih."
                : "Catatan akan muncul setelah karyawan melakukan absen."}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className={`${BTN_BASE} mt-4 border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
              >
                Reset filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Paginasi */}
      {total > 0 && (
        <nav
          aria-label="Paginasi absen"
          className="flex flex-col gap-4 border-t border-second/30 pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm tabular-nums text-second/60">
            Halaman {formatNumber(safePage)} dari {formatNumber(totalPages)}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1 || isFetching}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className={`${BTN_BASE} flex-1 border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none ${FOCUS_RING}`}
            >
              <FiChevronLeft size={16} aria-hidden="true" />
              Sebelumnya
            </button>

            <button
              type="button"
              disabled={safePage >= totalPages || isFetching}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              className={`${BTN_BASE} flex-1 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none ${FOCUS_RING}`}
            >
              Berikutnya
              <FiChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}

      {edit && (
        <EditDialog
          key={`${edit.record.id}-${edit.mode}`}
          record={edit.record}
          mode={edit.mode}
          busy={isSaving}
          apiError={editError}
          onClose={() => {
            if (!isSaving) setEdit(null);
          }}
          onSave={(iso) =>
            edit.mode === "check-in"
              ? saveCheckIn(iso)
              : saveCheckOut(iso, "Jam pulang disimpan.")
          }
          onReopen={() => saveCheckOut(null, "Sesi dibuka kembali.")}
        />
      )}
    </div>
  );
}
