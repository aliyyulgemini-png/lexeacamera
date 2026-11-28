"use client";

import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";

import { BTN_PRIMARY, Tag, describeError } from "./schedule-shared.jsx";

export const REQUEST_FORMS_PATH = "/owner/schedule-request-forms";
export const ADMIN_SCHEDULES_PATH = "/admin/schedules";
export const ADMIN_FORMS_PATH = "/admin/schedule-request-forms";

export const REQUEST_STATUS = {
  PENDING: { label: "Menunggu", tone: "strong" },
  APPROVED: { label: "Disetujui", tone: "success" },
  REJECTED: { label: "Ditolak", tone: "failure" },
};

export function RequestStatusTag({ status }) {
  const config = REQUEST_STATUS[status] ?? { label: status, tone: "outline" };
  return <Tag tone={config.tone}>{config.label}</Tag>;
}

/* Form dianggap terbuka kalau status OPEN dan batas waktunya belum lewat. */
export function formState(form) {
  if (form?.is_open) return { open: true, label: "Terbuka", tone: "success" };

  if (form?.status === "OPEN") {
    return { open: false, label: "Batas waktu lewat", tone: "outline" };
  }

  return { open: false, label: "Ditutup", tone: "outline" };
}

export function FormStateTag({ form }) {
  const state = formState(form);
  return <Tag tone={state.tone}>{state.label}</Tag>;
}

// "2026-12-24" -> "Kam, 24 Des 2026"
export function formatDay(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return `${date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })} WIB`;
}

// ISO -> nilai input datetime-local (zona waktu perangkat).
export function toLocalInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ErrorPanel({ error, onRetry, isFetching }) {
  const status = error?.response?.status;
  const notFound = status === 404;
  const forbidden = status === 403;

  const title = notFound
    ? "Data tidak ditemukan"
    : forbidden
      ? "Akses ditolak"
      : "Gagal memuat data";

  const description = forbidden
    ? "Akun Anda tidak punya akses ke data ini."
    : describeError(error);

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center"
    >
      <FiAlertTriangle size={32} className="text-second2" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-bold text-second">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-second/60">
        {description}
      </p>
      {!notFound && !forbidden && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isFetching}
          className={`${BTN_PRIMARY} mt-4`}
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
      )}
    </div>
  );
}
