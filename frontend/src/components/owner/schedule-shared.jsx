"use client";

import { useEffect, useRef } from "react";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiLoader,
  FiTrash2,
  FiX,
} from "react-icons/fi";

import { normalizeApiError } from "../../lib/api/errors.js";

/* -------------------------------------------------------------------------- */
/*  Design rules                                                              */
/*  Spacing : only 2, 4, 8, 16                                                */
/*  Warna sel jadwal berasal dari data item (hex), jadi dipasang inline.      */
/* -------------------------------------------------------------------------- */

export const SCHEDULES_PATH = "/owner/schedules";
export const ITEMS_PATH = "/owner/schedule-items";

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

export const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

export const BTN_PRIMARY = `${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;

export const BTN_OUTLINE = `${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;

export const BTN_DANGER = `${BTN_BASE} border border-second2/30 text-second2 hover:bg-second2 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;

export const labelClass = "mb-2 block text-sm font-semibold text-second";

export function inputClass(hasError) {
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

/* -------------------------------- Constants ------------------------------- */

export const CATEGORIES = [
  { id: "SHIFT", label: "Shift" },
  { id: "LEAVE", label: "Cuti" },
  { id: "OFF", label: "Libur" },
  { id: "OTHER", label: "Lainnya" },
];

export const categoryLabel = (value) =>
  CATEGORIES.find((item) => item.id === value)?.label ?? value;

export const STATUS_LABEL = {
  DRAFT: { label: "Draf", tone: "outline" },
  PUBLISHED: { label: "Dipublikasikan", tone: "success" },
};

export const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/* -------------------------------- Formatters ------------------------------ */

// "2026-12" -> "Desember 2026"
export function formatMonth(value) {
  if (!MONTH_RE.test(String(value ?? ""))) return value ?? "—";

  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}-01T00:00:00Z`));
}

// Bulan berjalan di WIB, format YYYY-MM.
export function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  return `${year}-${month}`;
}

export function formatTimeRange(item) {
  if (!item?.start_time && !item?.end_time) return "—";
  return `${item.start_time ?? "?"} – ${item.end_time ?? "?"}`;
}

/* --------------------------------- Errors --------------------------------- */

export function describeError(error) {
  return normalizeApiError(error).message;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Docs menyebut id jadwal yang sudah ada tercantum di pesan error 409.
export function extractUuid(error) {
  try {
    return (
      JSON.stringify(error?.response?.data ?? "").match(UUID_RE)?.[0] ?? null
    );
  } catch {
    return null;
  }
}

/* ------------------------------ Small pieces ------------------------------ */

export function Spinner() {
  return (
    <FiLoader
      className="animate-spin motion-reduce:animate-none"
      size={16}
      aria-hidden="true"
    />
  );
}

export function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/20 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    grad: "bg-grad text-primary",
    success: "bg-second3 text-primary",
    failure: "bg-second2 text-primary",
  };

  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function ErrorText({ id, children }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-2 flex items-start gap-2 text-sm text-second2"
    >
      <FiAlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

export function FormError({ children }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
    >
      <FiAlertTriangle
        size={16}
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export function Switch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-grad" : "bg-second/20"
      } ${FOCUS_RING}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block size-5 rounded-full bg-primary shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// Kode item dengan warna dari data (hex), seperti tampil di sel jadwal.
export function ItemChip({ item, className = "" }) {
  return (
    <span
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-xl border border-second/20 px-2 text-xs font-bold ${className}`}
      style={{ backgroundColor: item.color, color: item.text_color }}
    >
      {item.code}
    </span>
  );
}

export function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <article className="flex min-w-0 items-center gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/25">
        <Icon size={16} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-second/60">{label}</p>
        <p className="mt-1 break-words text-lg font-bold tabular-nums text-second">
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-second/60">{hint}</p>}
      </div>
    </article>
  );
}

export function Card({ title, description, aside, children }) {
  return (
    <section className="flex min-w-0 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-second">{title}</h2>
          {description && (
            <p className="mt-2 text-pretty text-sm text-second/60">
              {description}
            </p>
          )}
        </div>
        {aside}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/* --------------------------------- Dialogs -------------------------------- */

export function Modal({
  titleId,
  onClose,
  busy = false,
  wide = false,
  children,
}) {
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !busyRef.current) onCloseRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={busy ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className={`max-h-[90dvh] w-full ${
          wide ? "max-w-xl" : "max-w-md"
        } overflow-y-auto overscroll-contain rounded-2xl border border-second/30 bg-primary p-4 shadow-2xl sm:p-8`}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  icon: Icon,
  tone = "grad",
  onClose,
  busy = false,
}) {
  const tones = {
    grad: "bg-grad text-primary shadow-lg shadow-second4/20",
    danger: "bg-second2 text-primary shadow-lg shadow-second2/25",
    warning: "bg-second4 text-primary shadow-lg shadow-second4/25",
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
      >
        <Icon size={16} aria-hidden="true" />
      </div>

      <button
        type="button"
        onClick={onClose}
        disabled={busy}
        aria-label="Tutup dialog"
        className={`flex size-8 items-center justify-center rounded-xl text-second/60 transition-colors hover:bg-second/10 hover:text-second disabled:opacity-50 ${FOCUS_RING}`}
      >
        <FiX size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel,
  tone = "danger",
  busy = false,
  error = "",
  extra = null,
  onClose,
  onConfirm,
}) {
  return (
    <Modal titleId="confirm-title" onClose={onClose} busy={busy}>
      <DialogHeader
        icon={tone === "danger" ? FiTrash2 : FiAlertTriangle}
        tone={tone}
        onClose={onClose}
        busy={busy}
      />

      <h2 id="confirm-title" className="mt-4 text-lg font-bold text-second">
        {title}
      </h2>

      <div className="mt-2 text-sm leading-relaxed text-second/60">
        {children}
      </div>

      {error && (
        <div className="mt-4">
          <FormError>{error}</FormError>
        </div>
      )}

      {extra && <div className="mt-4">{extra}</div>}

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
          type="button"
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
          className={`${BTN_BASE} w-full sm:w-auto ${
            tone === "danger"
              ? "bg-second2 text-primary shadow-lg shadow-second2/25"
              : "bg-grad text-primary shadow-lg shadow-second4/25"
          } hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        >
          {busy ? (
            <>
              <Spinner />
              {busyLabel}
            </>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Modal>
  );
}
