"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link.js";
import { useParams } from "next/navigation.js";
import { useQueryClient } from "@tanstack/react-query";
import {
  FiArrowLeft,
  FiClock,
  FiMessageSquare,
  FiRefreshCw,
  FiUsers,
  FiX,
} from "react-icons/fi";

import {
  useGetAdminRequestForm,
  useSaveAdminFormEntries,
  useUpdateAdminRequest,
} from "../../../../features/schedules/request-hooks.js";
import RequestGrid, {
  RequestLegend,
  StatusMark,
  requestCellProps,
} from "../../../../../components/owner/schedule-request-grid.jsx";
import {
  ADMIN_FORMS_PATH,
  ErrorPanel,
  FormStateTag,
  RequestStatusTag,
  formatDateTime,
  formatDay,
} from "../../../../../components/owner/schedule-request-shared.jsx";
import {
  BTN_BASE,
  BTN_OUTLINE,
  BTN_PRIMARY,
  Card,
  DialogHeader,
  FOCUS_RING,
  FormError,
  ItemChip,
  Modal,
  Spinner,
  StatCard,
  Tag,
  describeError,
  formatMonth,
  inputClass,
  labelClass,
} from "../../../../../components/owner/schedule-shared.jsx";
import { SpecialDateLegend } from "../../../../../components/owner/schedule-special-dates.jsx";
import notify from "../../../../../lib/notify.js";

const ERASE = "__erase__";
const NOTE = "__note__";
const FLUSH_DELAY = 500;
const MAX_BATCH = 5000;

const cellKey = (employeeId, date) => `${employeeId}|${date}`;

/* -------------------------------- Note dialog ----------------------------- */

function NoteDialog({ target, busy, error, onClose, onSubmit }) {
  const [note, setNote] = useState(target.face.note ?? "");

  return (
    <Modal titleId="note-title" onClose={onClose} busy={busy}>
      <DialogHeader icon={FiMessageSquare} onClose={onClose} busy={busy} />

      <h2 id="note-title" className="mt-4 text-lg font-bold text-second">
        Alasan request
      </h2>

      <div className="mt-4 flex items-center gap-4 rounded-xl bg-second/[0.03] p-4">
        <ItemChip item={target.face} />
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-second">
            {target.name}
          </p>
          <p className="mt-2 text-xs tabular-nums text-second/60">
            {formatDay(target.date)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="note-text" className={labelClass}>
          Alasan
          <span className="ml-2 text-xs font-normal text-second/50">
            Opsional
          </span>
        </label>
        <textarea
          id="note-text"
          rows={3}
          maxLength={500}
          value={note}
          autoFocus
          disabled={busy}
          placeholder="Contoh: Acara keluarga"
          onChange={(event) => setNote(event.target.value)}
          className={inputClass(false)}
        />
      </div>

      {error && (
        <div className="mt-4">
          <FormError>{error}</FormError>
        </div>
      )}

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
          onClick={() => onSubmit(note)}
          disabled={busy}
          aria-busy={busy}
          className={`${BTN_PRIMARY} w-full sm:w-auto`}
        >
          {busy ? (
            <>
              <Spinner />
              Menyimpan…
            </>
          ) : (
            "Simpan alasan"
          )}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------ Save indicator ---------------------------- */

function SaveIndicator({ state, error }) {
  if (state === "error") {
    return (
      <p
        role="alert"
        className="rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
      >
        Perubahan tidak tersimpan. {error} Tabel dimuat ulang sesuai data
        terbaru.
      </p>
    );
  }

  const text = {
    pending: "Menunggu disimpan…",
    saving: "Menyimpan…",
    saved: "Semua perubahan tersimpan",
    idle: "Pilih kode, lalu klik atau seret di sel",
  }[state];

  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 text-sm text-second/60"
    >
      {(state === "pending" || state === "saving") && <Spinner />}
      {text}
    </p>
  );
}

/* ------------------------------ Request list ------------------------------ */

// Disusun dari isi tabel, supaya status dan catatan owner terbaca tanpa hover.
function RequestList({ rows, dates, view }) {
  const [status, setStatus] = useState("");

  const requests = dates
    .flatMap((day) =>
      rows.map((row) => {
        const key = cellKey(row.employee.id, day.date);
        const face = view[key];
        return (
          face && { ...face, key, date: day.date, name: row.employee.name }
        );
      }),
    )
    .filter((request) => request && (!status || request.status === status));

  return (
    <Card
      title="Daftar request"
      description="Status, alasan, dan catatan dari owner untuk setiap request."
      aside={<Tag tone="soft">{requests.length} ditampilkan</Tag>}
    >
      <div className="min-w-0 sm:w-64">
        <label htmlFor="admin-rq-status" className={labelClass}>
          Status
        </label>
        <select
          id="admin-rq-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={inputClass(false)}
        >
          <option value="">Semua</option>
          <option value="PENDING">Menunggu</option>
          <option value="APPROVED">Disetujui</option>
          <option value="REJECTED">Ditolak</option>
        </select>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-second/60">
          {status
            ? "Tidak ada request dengan status ini."
            : "Belum ada request."}
        </p>
      ) : (
        <ul className="divide-y divide-second/10 rounded-xl border border-second/30">
          {requests.map((request) => (
            <li key={request.key} className="flex min-w-0 flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-second">
                    {request.name}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-second/60">
                    {formatDay(request.date)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ItemChip item={request} />
                  <StatusMark status={request.status} />
                  <RequestStatusTag status={request.status} />
                </div>
              </div>
              {request.note && (
                <p className="break-words text-xs text-second/70">
                  Alasan: {request.note}
                </p>
              )}
              {request.owner_note && (
                <p
                  className={`break-words rounded-xl px-4 py-2 text-xs ${
                    request.status === "REJECTED"
                      ? "bg-second2/5 text-second2"
                      : "bg-second/[0.03] text-second/70"
                  }`}
                >
                  Catatan owner: {request.owner_note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function AdminRequestFormPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const query = useGetAdminRequestForm(id);
  const saveMutation = useSaveAdminFormEntries();
  const noteMutation = useUpdateAdminRequest();

  const form = query.data;

  const [selected, setSelected] = useState(null);
  const [view, setView] = useState({});
  const [saveState, setSaveState] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const [noteTarget, setNoteTarget] = useState(null);
  const [noteError, setNoteError] = useState("");

  const viewRef = useRef({});
  const selectedRef = useRef(null);
  const pendingRef = useRef(new Map());
  const savingRef = useRef(false);
  const timerRef = useRef(null);
  const paintingRef = useRef(false);
  const quotaWarnedRef = useRef(false);
  const flushRef = useRef(() => {});
  const mutateRef = useRef(saveMutation.mutateAsync);
  const refetchRef = useRef(query.refetch);
  const openRef = useRef(false);
  const maxRef = useRef(null);
  const datesRef = useRef([]);
  const allowedRef = useRef({});

  const allowed = useMemo(() => form?.allowed_items ?? [], [form]);
  const rows = useMemo(() => form?.rows ?? [], [form]);
  const dates = useMemo(() => form?.dates ?? [], [form]);

  selectedRef.current = selected;
  mutateRef.current = saveMutation.mutateAsync;
  refetchRef.current = query.refetch;
  openRef.current = Boolean(form?.is_open);
  maxRef.current = form?.max_days_per_employee ?? null;
  datesRef.current = dates;
  allowedRef.current = Object.fromEntries(
    allowed.map((item) => [item.id, item]),
  );

  const applyServer = useCallback((data) => {
    const next = {};

    for (const row of data.rows ?? []) {
      for (const [date, cell] of Object.entries(row.days ?? {})) {
        next[cellKey(row.employee.id, date)] = {
          itemId: cell.schedule_item_id,
          code: cell.code,
          color: cell.color,
          text_color: cell.text_color,
          status: cell.status,
          request_id: cell.request_id,
          note: cell.note,
          owner_note: cell.owner_note,
        };
      }
    }

    viewRef.current = next;
    setView(next);
  }, []);

  // Sinkronkan dari server hanya kalau tidak ada perubahan yang belum terkirim.
  useEffect(() => {
    if (!form) return;
    if (pendingRef.current.size > 0 || savingRef.current) return;
    applyServer(form);
  }, [form, applyServer]);

  // Kode pertama sebagai pilihan awal.
  useEffect(() => {
    if (selected !== null || allowed.length === 0) return;
    setSelected(allowed[0].id);
  }, [selected, allowed]);

  const scheduleFlush = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flushRef.current(), FLUSH_DELAY);
  }, []);

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    if (savingRef.current || pendingRef.current.size === 0) return;

    const batch = [...pendingRef.current.values()];
    pendingRef.current = new Map();
    savingRef.current = true;
    setSaveState("saving");

    try {
      for (let index = 0; index < batch.length; index += MAX_BATCH) {
        await mutateRef.current({
          id,
          entries: batch.slice(index, index + MAX_BATCH),
        });
      }

      savingRef.current = false;

      if (pendingRef.current.size > 0) {
        setSaveState("pending");
        scheduleFlush();
        return;
      }

      setSaveState("saved");

      // Ambil request_id dan status terbaru dari cache yang sudah dimuat ulang.
      const fresh = queryClient.getQueryData([
        "admin schedule request form",
        id,
      ]);
      if (fresh) applyServer(fresh);
    } catch (error) {
      savingRef.current = false;
      pendingRef.current = new Map();
      clearTimeout(timerRef.current);

      setSaveError(describeError(error));
      setSaveState("error");

      // Seluruh batch dibatalkan server. Kembalikan tampilan ke data terbaru.
      const result = await refetchRef.current();
      if (result?.data) applyServer(result.data);
    }
  }, [id, queryClient, scheduleFlush, applyServer]);

  flushRef.current = flush;

  function usedFor(employeeId) {
    let used = 0;

    for (const day of datesRef.current) {
      const face = viewRef.current[cellKey(employeeId, day.date)];
      if (face && (face.status === "PENDING" || face.status === "APPROVED")) {
        used += 1;
      }
    }

    return used;
  }

  function openNote(employeeId, date, name) {
    const face = viewRef.current[cellKey(employeeId, date)];
    if (!face) return;

    if (face.status !== "PENDING") {
      notify.error("Hanya request yang menunggu yang bisa diberi alasan.");
      return;
    }

    setNoteError("");
    setNoteTarget({ employeeId, date, name, face });
  }

  function applyCell(employeeId, date, name) {
    const choice = selectedRef.current;

    if (!openRef.current || choice === null || choice === NOTE) return;

    const key = cellKey(employeeId, date);
    const existing = viewRef.current[key];

    // Sel yang sudah diproses owner terkunci.
    if (existing && existing.status !== "PENDING") return;

    const item = choice === ERASE ? null : allowedRef.current[choice];

    if (choice !== ERASE && !item) return;
    if (!item && !existing) return;
    if (item && existing && existing.itemId === item.id) return;

    // Cek kuota di browser. Server tetap memeriksa ulang.
    if (item && !existing && maxRef.current != null) {
      if (usedFor(employeeId) >= maxRef.current) {
        if (!quotaWarnedRef.current) {
          quotaWarnedRef.current = true;
          notify.error(
            `Kuota ${name} sudah habis (${maxRef.current} hari). Hapus salah satu request dulu.`,
          );
        }
        return;
      }
    }

    const next = { ...viewRef.current };

    if (item) {
      next[key] = {
        itemId: item.id,
        code: item.code,
        color: item.color,
        text_color: item.text_color,
        status: "PENDING",
        request_id: existing?.request_id ?? null,
        note: existing?.note ?? null,
        owner_note: null,
      };
    } else {
      delete next[key];
    }

    viewRef.current = next;
    setView(next);

    pendingRef.current.set(key, {
      employee_id: employeeId,
      date,
      schedule_item_id: item ? item.id : null,
    });

    setSaveState((state) => (state === "saving" ? state : "pending"));
    scheduleFlush();
  }

  function pointerCell(employeeId, date, name) {
    if (selectedRef.current === NOTE) {
      openNote(employeeId, date, name);
      return;
    }

    applyCell(employeeId, date, name);
  }

  async function handleSaveNote(note) {
    setNoteError("");

    const requestId = noteTarget.face.request_id;
    if (!requestId) {
      setNoteError(
        "Request ini belum tersimpan. Tunggu sebentar lalu coba lagi.",
      );
      return;
    }

    try {
      await noteMutation.mutateAsync({
        id: requestId,
        data: { note: note.trim() || null },
      });
      notify.success("Alasan disimpan.");
      setNoteTarget(null);
    } catch (error) {
      setNoteError(describeError(error));
    }
  }

  // Seret mouse untuk mengisi banyak sel.
  useEffect(() => {
    function stop() {
      paintingRef.current = false;
      quotaWarnedRef.current = false;
    }
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  // Kirim sisa perubahan saat halaman ditinggalkan.
  useEffect(() => {
    const queue = pendingRef;
    return () => {
      clearTimeout(timerRef.current);
      if (queue.current.size > 0) flushRef.current();
    };
  }, []);

  // Peringatan sebelum menutup tab kalau masih ada yang belum tersimpan.
  useEffect(() => {
    if (saveState !== "pending" && saveState !== "saving") return undefined;

    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveState]);

  async function handleRefresh() {
    await flushRef.current();
    const result = await query.refetch();

    if (result.data && pendingRef.current.size === 0 && !savingRef.current) {
      applyServer(result.data);
    }
  }

  const backLink = (
    <Link
      href={ADMIN_FORMS_PATH}
      className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
    >
      <FiArrowLeft size={16} aria-hidden="true" />
      Kembali ke request jadwal
    </Link>
  );

  if (query.isPending) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <div className="h-8 w-48 animate-pulse rounded-full bg-second/10" />
        <div className="h-24 animate-pulse rounded-2xl bg-second/10" />
        <div className="h-96 animate-pulse rounded-2xl bg-second/10" />
      </div>
    );
  }

  if (query.isError || !form) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>{backLink}</header>
        <ErrorPanel
          error={query.error}
          onRetry={() => query.refetch()}
          isFetching={query.isFetching}
        />
      </div>
    );
  }

  const isOpen = Boolean(form.is_open);
  const max = form.max_days_per_employee ?? null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        {backLink}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-second/60">{formatMonth(form.month)}</p>
            <h1 className="mt-2 break-words text-xl font-bold tracking-tight text-second sm:text-2xl">
              {form.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <FormStateTag form={form} />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={query.isFetching}
            className={`${BTN_OUTLINE} w-full sm:w-auto`}
          >
            <FiRefreshCw
              size={16}
              className={
                query.isFetching
                  ? "animate-spin motion-reduce:animate-none"
                  : ""
              }
              aria-hidden="true"
            />
            Perbarui
          </button>
        </div>

        {form.description && (
          <p className="whitespace-pre-line break-words rounded-xl bg-second/[0.03] p-4 text-sm text-second/70">
            {form.description}
          </p>
        )}

        {!isOpen && (
          <p className="rounded-xl border border-second4/30 bg-second4/5 px-4 py-2 text-sm text-second4">
            Form ini sudah ditutup. Tabel hanya bisa dilihat.
          </p>
        )}
      </header>

      <section
        aria-label="Ringkasan form"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <StatCard
          icon={FiUsers}
          label="Kuota per karyawan"
          value={max == null ? "Tanpa batas" : `${max} hari`}
          hint="Menunggu dan disetujui"
        />
        <StatCard
          icon={FiClock}
          label="Batas waktu"
          value={
            form.closes_at ? formatDateTime(form.closes_at) : "Tanpa batas"
          }
        />
        <StatCard
          icon={FiUsers}
          label="Karyawan"
          value={rows.length}
          hint="Baris di tabel"
        />
      </section>

      <section className="flex min-w-0 flex-col gap-4">
        {/* Palet */}
        <div className="sticky top-0 z-20 flex flex-col gap-2 rounded-2xl border border-second/30 bg-primary/90 p-4 shadow-xl shadow-second/5 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-second/60">
              Pilih kode
            </span>

            {allowed.map((item) => {
              const isSelected = selected === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item.id)}
                  disabled={!isOpen}
                  aria-pressed={isSelected}
                  title={item.name}
                  className={`rounded-xl p-0.5 transition disabled:opacity-50 ${FOCUS_RING} ${
                    isSelected
                      ? "ring-2 ring-second4"
                      : "ring-1 ring-transparent hover:ring-second/30"
                  }`}
                >
                  <ItemChip item={item} />
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSelected(ERASE)}
              disabled={!isOpen}
              aria-pressed={selected === ERASE}
              className={`${BTN_BASE} h-8 border text-xs disabled:opacity-50 ${FOCUS_RING} ${
                selected === ERASE
                  ? "border-second2 bg-second2/10 text-second2"
                  : "border-second/30 text-second hover:border-second2 hover:text-second2"
              }`}
            >
              <FiX size={16} aria-hidden="true" />
              Hapus
            </button>

            <button
              type="button"
              onClick={() => setSelected(NOTE)}
              disabled={!isOpen}
              aria-pressed={selected === NOTE}
              className={`${BTN_BASE} h-8 border text-xs disabled:opacity-50 ${FOCUS_RING} ${
                selected === NOTE
                  ? "border-second4 bg-second4/10 text-second4"
                  : "border-second/30 text-second hover:border-second4 hover:text-second4"
              }`}
            >
              <FiMessageSquare size={16} aria-hidden="true" />
              Isi alasan
            </button>

            {allowed.length === 0 && (
              <span className="text-xs text-second2">
                Belum ada kode yang bisa dipilih. Hubungi owner.
              </span>
            )}
          </div>

          <SaveIndicator state={saveState} error={saveError} />
        </div>

        {rows.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 px-4 py-16 text-center">
            <p className="text-sm font-semibold text-second">
              Belum ada karyawan di form ini
            </p>
          </div>
        ) : (
          <RequestGrid
            dates={dates}
            rows={rows}
            myEmployeeId={form.my_employee_id}
            dimmed={query.isFetching}
            quotaCell={(row) => {
              const used = Object.keys(view).reduce(
                (count, key) =>
                  key.startsWith(`${row.employee.id}|`) &&
                  (view[key].status === "PENDING" ||
                    view[key].status === "APPROVED")
                    ? count + 1
                    : count,
                0,
              );

              return (
                <span
                  className={max != null && used > max ? "text-second2" : ""}
                >
                  {max == null ? used : `${used}/${max}`}
                </span>
              );
            }}
            renderCell={(row, day) => {
              const face = view[cellKey(row.employee.id, day.date)];
              const props = requestCellProps(face);
              const locked = !isOpen || (face && face.status !== "PENDING");

              return (
                <button
                  type="button"
                  disabled={locked}
                  title={`${row.employee.name}, ${day.date}: ${
                    face ? `${face.code} (${props.label})` : "kosong"
                  }${face?.note ? `\nAlasan: ${face.note}` : ""}${
                    face?.owner_note
                      ? `\nCatatan owner: ${face.owner_note}`
                      : ""
                  }`}
                  aria-label={`${row.employee.name} tanggal ${day.day}: ${
                    face ? `${face.code}, ${props.label}` : "kosong"
                  }`}
                  onMouseDown={(event) => {
                    if (event.button !== 0 || locked) return;
                    paintingRef.current = true;
                    quotaWarnedRef.current = false;
                    pointerCell(row.employee.id, day.date, row.employee.name);
                  }}
                  onMouseEnter={() => {
                    if (paintingRef.current && selectedRef.current !== NOTE) {
                      applyCell(row.employee.id, day.date, row.employee.name);
                    }
                  }}
                  onClick={() =>
                    pointerCell(row.employee.id, day.date, row.employee.name)
                  }
                  onContextMenu={(event) => {
                    if (face?.status !== "PENDING") return;
                    event.preventDefault();
                    openNote(row.employee.id, day.date, row.employee.name);
                  }}
                  className={`flex h-8 w-8 select-none items-center justify-center text-xs font-semibold transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:hover:opacity-100 ${FOCUS_RING} ${props.className}`}
                  style={props.style}
                >
                  {face?.code ?? ""}
                </button>
              );
            }}
          />
        )}

        <RequestLegend />
        <SpecialDateLegend specialDates={form.special_dates} />

        <p className="text-xs text-second/60">
          Pilih kode, lalu klik atau seret di sel karyawan mana pun. Perubahan
          disimpan otomatis. Sel yang sudah disetujui atau ditolak owner
          terkunci. Untuk menambah alasan, pilih “Isi alasan” lalu klik sel yang
          menunggu (atau klik kanan di desktop).
        </p>
      </section>

      <RequestList rows={rows} dates={dates} view={view} />

      <Card
        title="Cara kerja"
        description="Request menunggu diproses owner. Yang disetujui otomatis masuk ke jadwal."
      >
        <ul className="flex flex-col gap-2 text-sm text-second/70">
          <li>
            Kuota {max == null ? "tidak dibatasi" : `${max} hari per karyawan`}.
            Yang dihitung: request menunggu dan disetujui.
          </li>
          <li>Satu karyawan hanya bisa punya satu request per tanggal.</li>
          <li>
            {form.closes_at
              ? `Form dibuka sampai ${formatDateTime(form.closes_at)}.`
              : "Form dibuka sampai ditutup owner."}
          </li>
        </ul>
      </Card>

      {noteTarget && (
        <NoteDialog
          target={noteTarget}
          busy={noteMutation.isPending}
          error={noteError}
          onClose={() => {
            if (!noteMutation.isPending) setNoteTarget(null);
          }}
          onSubmit={handleSaveNote}
        />
      )}
    </div>
  );
}
