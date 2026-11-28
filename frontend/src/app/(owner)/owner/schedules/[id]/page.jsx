"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCalendar,
  FiChevronDown,
  FiChevronUp,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiPlus,
  FiRefreshCw,
  FiSliders,
  FiTrash2,
  FiUsers,
  FiX,
} from "react-icons/fi";

import {
  useAddScheduleEmployees,
  useDeleteSchedule,
  useGetSchedule,
  useGetScheduleEmployeeOptions,
  useRemoveScheduleEmployee,
  useReorderScheduleEmployees,
  useSaveScheduleEntries,
  useUpdateSchedule,
} from "../../../../features/schedules/hooks.js";
import {
  BTN_BASE,
  BTN_OUTLINE,
  BTN_PRIMARY,
  Card,
  ConfirmDialog,
  DialogHeader,
  FOCUS_RING,
  FormError,
  ITEMS_PATH,
  ItemChip,
  Modal,
  SCHEDULES_PATH,
  STATUS_LABEL,
  Spinner,
  StatCard,
  Tag,
  WEEKDAYS,
  describeError,
  formatMonth,
  formatTimeRange,
  inputClass,
  labelClass,
} from "../../../../../components/owner/schedule-shared.jsx";
import notify from "../../../../../lib/notify.js";
import ExportScheduleButton from "../../../../../components/owner/export-schedule-button.jsx";

const ERASE = "__erase__";
const FLUSH_DELAY = 500;
const MAX_BATCH = 5000;

const cellKey = (employeeId, date) => `${employeeId}|${date}`;

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

// "2026-12-25" -> "25 Des". Tanpa new Date() supaya tidak kena zona waktu.
function formatShortDate(value) {
  const [, month, day] = value.split("-").map(Number);
  return `${day} ${SHORT_MONTHS[month - 1]}`;
}

function buildCells(rows = []) {
  const cells = {};

  for (const row of rows) {
    for (const [date, cell] of Object.entries(row.days ?? {})) {
      cells[cellKey(row.employee.id, date)] = cell.schedule_item_id;
    }
  }

  return cells;
}

/* --------------------------------- Dialogs -------------------------------- */

function EditInfoDialog({ schedule, busy, error, onClose, onSubmit }) {
  const [title, setTitle] = useState(schedule.title ?? "");
  const [notes, setNotes] = useState(schedule.notes ?? "");
  const [localError, setLocalError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim()) {
      setLocalError("Judul wajib diisi.");
      return;
    }
    if (title.trim().length > 150) {
      setLocalError("Judul maksimal 150 karakter.");
      return;
    }

    const data = {};
    if (title.trim() !== (schedule.title ?? "")) data.title = title.trim();
    if (notes.trim() !== (schedule.notes ?? "")) data.notes = notes.trim();

    if (Object.keys(data).length === 0) {
      onClose();
      return;
    }

    onSubmit(data);
  }

  return (
    <Modal titleId="edit-info-title" onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit} noValidate>
        <DialogHeader icon={FiEdit2} onClose={onClose} busy={busy} />

        <h2 id="edit-info-title" className="mt-4 text-lg font-bold text-second">
          Ubah info jadwal
        </h2>

        <div className="mt-8 flex flex-col gap-4">
          <div className="min-w-0">
            <label htmlFor="info-title" className={labelClass}>
              Judul
            </label>
            <input
              id="info-title"
              value={title}
              maxLength={150}
              disabled={busy}
              autoFocus
              autoComplete="off"
              onChange={(event) => {
                setTitle(event.target.value);
                setLocalError("");
              }}
              aria-invalid={localError ? "true" : undefined}
              className={inputClass(Boolean(localError))}
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="info-notes" className={labelClass}>
              Catatan
            </label>
            <textarea
              id="info-notes"
              rows={3}
              value={notes}
              disabled={busy}
              onChange={(event) => setNotes(event.target.value)}
              className={inputClass(false)}
            />
          </div>

          <p className="text-xs text-second/60">
            Bulan tidak bisa diubah. Kalau salah bulan, hapus lalu buat ulang.
          </p>

          {(localError || error) && (
            <FormError>{localError || error}</FormError>
          )}
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
              "Simpan"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddEmployeesDialog({ scheduleId, existingIds, onClose }) {
  const addMutation = useAddScheduleEmployees();
  const employeesQuery = useGetScheduleEmployeeOptions(true);

  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState("");

  const available = useMemo(
    () =>
      (employeesQuery.data ?? []).filter(
        (employee) => !existingIds.has(employee.id),
      ),
    [employeesQuery.data, existingIds],
  );

  const busy = addMutation.isPending;

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (selected.size === 0) {
      setError("Pilih minimal 1 karyawan.");
      return;
    }

    try {
      const result = await addMutation.mutateAsync({
        id: scheduleId,
        employeeIds: [...selected],
      });
      notify.success(
        `${result?.added ?? selected.size} karyawan ditambahkan${
          result?.skipped ? `, ${result.skipped} dilewati` : ""
        }.`,
      );
      onClose();
    } catch (err) {
      // Ada karyawan yang sudah tidak ada di DB: muat ulang daftarnya.
      if (err?.response?.status === 404) {
        setSelected(new Set());
        employeesQuery.refetch();
      }
      setError(describeError(err));
    }
  }

  return (
    <Modal titleId="add-employees-title" onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit} noValidate>
        <DialogHeader icon={FiUsers} onClose={onClose} busy={busy} />

        <h2
          id="add-employees-title"
          className="mt-4 text-lg font-bold text-second"
        >
          Tambah karyawan
        </h2>
        <p className="mt-2 text-sm text-second/60">
          Karyawan baru ditaruh di urutan paling bawah.
        </p>

        <div className="mt-8 max-h-64 overflow-y-auto rounded-xl border border-second/30">
          {employeesQuery.isPending ? (
            <p role="status" className="p-4 text-sm text-second/60">
              Memuat karyawan…
            </p>
          ) : employeesQuery.isError && !employeesQuery.data ? (
            <div className="flex flex-wrap items-center gap-2 p-4">
              <p role="alert" className="text-sm text-second2">
                {describeError(employeesQuery.error)}
              </p>
              <button
                type="button"
                onClick={() => employeesQuery.refetch()}
                className={BTN_OUTLINE}
              >
                Coba lagi
              </button>
            </div>
          ) : available.length === 0 ? (
            <p className="p-4 text-sm text-second/60">
              Semua karyawan sudah ada di jadwal ini.
            </p>
          ) : (
            <ul className="divide-y divide-second/10">
              {available.map((employee) => (
                <li key={employee.id}>
                  <label className="flex cursor-pointer items-center gap-4 p-4 hover:bg-second/5">
                    <input
                      type="checkbox"
                      checked={selected.has(employee.id)}
                      disabled={busy}
                      onChange={() => toggle(employee.id)}
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
            type="submit"
            disabled={busy || available.length === 0}
            aria-busy={busy}
            className={`${BTN_PRIMARY} w-full sm:w-auto`}
          >
            {busy ? (
              <>
                <Spinner />
                Menambahkan…
              </>
            ) : (
              `Tambah (${selected.size})`
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------ Save indicator ---------------------------- */

function SaveIndicator({ state, error, onRetry, onDiscard }) {
  if (state === "error") {
    return (
      <div
        role="alert"
        className="flex flex-col gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2 sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="flex min-w-0 items-start gap-2">
          <FiAlertTriangle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span className="min-w-0">Perubahan belum tersimpan. {error}</span>
        </span>
        <span className="flex shrink-0 gap-2">
          <button type="button" onClick={onRetry} className={BTN_OUTLINE}>
            Coba lagi
          </button>
          <button type="button" onClick={onDiscard} className={BTN_OUTLINE}>
            Buang perubahan
          </button>
        </span>
      </div>
    );
  }

  const text = {
    pending: "Menunggu disimpan…",
    saving: "Menyimpan…",
    saved: "Semua perubahan tersimpan",
    idle: "Klik atau seret di sel untuk mengisi",
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

/* --------------------------------- Employees ------------------------------ */

function EmployeesSection({ scheduleId, rows, onRemoved }) {
  const reorderMutation = useReorderScheduleEmployees();
  const removeMutation = useRemoveScheduleEmployee();

  const [showAdd, setShowAdd] = useState(false);
  const [toRemove, setToRemove] = useState(null);
  const [removeError, setRemoveError] = useState("");

  const existingIds = useMemo(
    () => new Set(rows.map((row) => row.employee.id)),
    [rows],
  );

  function move(index, direction) {
    const ids = rows.map((row) => row.employee.id);
    const target = index + direction;

    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];

    reorderMutation.mutate(
      { id: scheduleId, employeeIds: ids },
      { onError: (error) => notify.error(describeError(error)) },
    );
  }

  async function handleRemove() {
    setRemoveError("");

    try {
      await removeMutation.mutateAsync({
        id: scheduleId,
        employeeId: toRemove.employee.id,
      });
      onRemoved(toRemove.employee.id);
      notify.success("Karyawan dikeluarkan dari jadwal.");
      setToRemove(null);
    } catch (error) {
      setRemoveError(describeError(error));
    }
  }

  return (
    <Card
      title="Karyawan di jadwal"
      description="Atur urutan baris atau keluarkan karyawan. Data karyawannya sendiri tidak terhapus."
      aside={
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className={BTN_OUTLINE}
        >
          <FiPlus size={16} aria-hidden="true" />
          Tambah karyawan
        </button>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-second/60">
          Belum ada karyawan di jadwal ini.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-second/10 rounded-xl border border-second/30">
          {rows.map((row, index) => (
            <li
              key={row.schedule_employee_id}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-second">
                  {row.employee.name}
                </p>
                {row.employee.employee_code && (
                  <p className="mt-2 font-mono text-xs text-second/60">
                    {row.employee.employee_code}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || reorderMutation.isPending}
                  aria-label={`Naikkan ${row.employee.name}`}
                  className={`${BTN_BASE} size-8 border border-second/30 !p-0 text-second hover:border-second4 hover:text-second4 disabled:opacity-40 ${FOCUS_RING}`}
                >
                  <FiChevronUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={
                    index === rows.length - 1 || reorderMutation.isPending
                  }
                  aria-label={`Turunkan ${row.employee.name}`}
                  className={`${BTN_BASE} size-8 border border-second/30 !p-0 text-second hover:border-second4 hover:text-second4 disabled:opacity-40 ${FOCUS_RING}`}
                >
                  <FiChevronDown size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRemoveError("");
                    setToRemove(row);
                  }}
                  aria-label={`Keluarkan ${row.employee.name}`}
                  className={`${BTN_BASE} size-8 border border-second/30 !p-0 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
                >
                  <FiTrash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showAdd && (
        <AddEmployeesDialog
          scheduleId={scheduleId}
          existingIds={existingIds}
          onClose={() => setShowAdd(false)}
        />
      )}

      {toRemove && (
        <ConfirmDialog
          title="Keluarkan dari jadwal?"
          confirmLabel="Ya, keluarkan"
          busyLabel="Memproses…"
          busy={removeMutation.isPending}
          error={removeError}
          onClose={() => {
            if (!removeMutation.isPending) setToRemove(null);
          }}
          onConfirm={handleRemove}
        >
          <p>
            <span className="font-semibold text-second">
              {toRemove.employee.name}
            </span>{" "}
            dikeluarkan dari jadwal ini dan seluruh isi selnya ikut terhapus.
            Data karyawannya tetap ada.
          </p>
        </ConfirmDialog>
      )}
    </Card>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function ScheduleEditorPage() {
  const { id } = useParams();
  const router = useRouter();

  const query = useGetSchedule(id);
  const data = query.data;

  const saveMutation = useSaveScheduleEntries();
  const updateMutation = useUpdateSchedule();
  const deleteMutation = useDeleteSchedule();

  const [selected, setSelected] = useState(null);
  const [cells, setCells] = useState({});
  const [saveState, setSaveState] = useState("idle");
  const [saveError, setSaveError] = useState("");

  const [showInfo, setShowInfo] = useState(false);
  const [infoError, setInfoError] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const cellsRef = useRef({});
  const selectedRef = useRef(null);
  const pendingRef = useRef(new Map());
  const savingRef = useRef(false);
  const timerRef = useRef(null);
  const paintingRef = useRef(false);
  const flushRef = useRef(() => {});
  const activeIdsRef = useRef(new Set());
  const mutateRef = useRef(saveMutation.mutateAsync);

  selectedRef.current = selected;
  mutateRef.current = saveMutation.mutateAsync;

  const items = useMemo(() => data?.items ?? [], [data]);
  const activeItems = useMemo(
    () => items.filter((item) => item.is_active),
    [items],
  );
  const itemById = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, item])),
    [items],
  );

  activeIdsRef.current = new Set(activeItems.map((item) => item.id));

  const applyServer = useCallback((schedule) => {
    const next = buildCells(schedule.rows);
    cellsRef.current = next;
    setCells(next);
  }, []);

  // Sinkronkan dari server hanya kalau tidak ada perubahan yang belum terkirim.
  useEffect(() => {
    if (!data) return;
    if (pendingRef.current.size > 0 || savingRef.current) return;
    applyServer(data);
  }, [data, applyServer]);

  // Pilih item aktif pertama sebagai default.
  useEffect(() => {
    if (selected !== null || activeItems.length === 0) return;
    setSelected(activeItems[0].id);
  }, [selected, activeItems]);

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
      } else {
        setSaveState("saved");
      }
    } catch (error) {
      savingRef.current = false;

      // Kembalikan ke antrean tanpa menimpa klik yang lebih baru.
      for (const entry of batch) {
        const key = cellKey(entry.employee_id, entry.date);
        if (!pendingRef.current.has(key)) pendingRef.current.set(key, entry);
      }

      setSaveError(describeError(error));
      setSaveState("error");
    }
  }, [id, scheduleFlush]);

  flushRef.current = flush;

  const applyCell = useCallback(
    (employeeId, date) => {
      const choice = selectedRef.current;
      if (choice === null) return;

      const value = choice === ERASE ? null : choice;
      if (value !== null && !activeIdsRef.current.has(value)) return;

      const key = cellKey(employeeId, date);
      if ((cellsRef.current[key] ?? null) === value) return;

      const next = { ...cellsRef.current };
      if (value === null) delete next[key];
      else next[key] = value;

      cellsRef.current = next;
      setCells(next);

      pendingRef.current.set(key, {
        employee_id: employeeId,
        date,
        schedule_item_id: value,
      });

      setSaveState((state) => (state === "saving" ? state : "pending"));
      scheduleFlush();
    },
    [scheduleFlush],
  );

  // Seret mouse untuk mengisi banyak sel.
  useEffect(() => {
    function stop() {
      paintingRef.current = false;
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
    if (saveState === "idle" || saveState === "saved") return undefined;

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

  async function handleDiscard() {
    pendingRef.current = new Map();
    clearTimeout(timerRef.current);
    setSaveState("idle");
    setSaveError("");

    const result = await query.refetch();
    if (result.data) applyServer(result.data);
  }

  function handleEmployeeRemoved(employeeId) {
    for (const key of [...pendingRef.current.keys()]) {
      if (key.startsWith(`${employeeId}|`)) pendingRef.current.delete(key);
    }
  }

  async function handleToggleStatus() {
    const next = data.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";

    try {
      await updateMutation.mutateAsync({ id, data: { status: next } });
      notify.success(
        next === "PUBLISHED"
          ? "Jadwal dipublikasikan."
          : "Jadwal kembali ke draf.",
      );
    } catch (error) {
      notify.error(describeError(error));
    }
  }

  async function handleSaveInfo(payload) {
    setInfoError("");

    try {
      await updateMutation.mutateAsync({ id, data: payload });
      notify.success("Info jadwal diperbarui.");
      setShowInfo(false);
    } catch (error) {
      setInfoError(describeError(error));
    }
  }

  async function handleDelete() {
    setDeleteError("");

    try {
      pendingRef.current = new Map();
      clearTimeout(timerRef.current);
      await deleteMutation.mutateAsync(id);
      notify.success("Jadwal dihapus.");
      router.replace(SCHEDULES_PATH);
    } catch (error) {
      setDeleteError(describeError(error));
    }
  }

  /* --------------------------------- Render -------------------------------- */

  const backLink = (
    <Link
      href={SCHEDULES_PATH}
      className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
    >
      <FiArrowLeft size={16} aria-hidden="true" />
      Kembali ke daftar jadwal
    </Link>
  );

  if (query.isPending) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <div className="h-8 w-48 animate-pulse rounded-full bg-second/10" />
        <div className="h-16 animate-pulse rounded-2xl bg-second/10" />
        <div className="h-96 animate-pulse rounded-2xl bg-second/10" />
      </div>
    );
  }

  if (query.isError || !data) {
    const notFound = query.error?.response?.status === 404;

    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>{backLink}</header>
        <div
          role="alert"
          className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center"
        >
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            {notFound ? "Jadwal tidak ditemukan" : "Gagal memuat jadwal"}
          </h2>
          {!notFound && (
            <>
              <p className="mt-2 max-w-md text-sm text-second/60">
                {describeError(query.error)}
              </p>
              <button
                type="button"
                onClick={() => query.refetch()}
                disabled={query.isFetching}
                className={`${BTN_PRIMARY} mt-4`}
              >
                <FiRefreshCw size={16} aria-hidden="true" />
                {query.isFetching ? "Memuat…" : "Coba lagi"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const dates = data.dates ?? [];
  const rows = data.rows ?? [];
  const summaryColumns = data.summary_columns ?? [];
  const specialDates = data.special_dates ?? [];
  const status = STATUS_LABEL[data.status] ?? {
    label: data.status,
    tone: "outline",
  };
  const isPublished = data.status === "PUBLISHED";

  const codeById = Object.fromEntries(
    items.map((item) => [item.id, item.code]),
  );

  function summaryFor(row) {
    const counts = Object.fromEntries(summaryColumns.map((code) => [code, 0]));

    for (const day of dates) {
      const code = codeById[cells[cellKey(row.employee.id, day.date)]];
      if (code in counts) counts[code] += 1;
    }

    return counts;
  }

  let filledCount = 0;
  for (const row of rows) {
    for (const day of dates) {
      if (cells[cellKey(row.employee.id, day.date)]) filledCount += 1;
    }
  }
  const totalCells = rows.length * dates.length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4">
        {backLink}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiCalendar size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-second/60">
                {formatMonth(data.month)}
              </p>
              <h1 className="mt-2 break-words text-xl font-bold tracking-tight text-second sm:text-2xl">
                {data.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Tag tone={status.tone}>{status.label}</Tag>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={query.isFetching}
              className={BTN_OUTLINE}
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
            <Link href={ITEMS_PATH} className={BTN_OUTLINE}>
              <FiSliders size={16} aria-hidden="true" />
              Kelola item
            </Link>
            <ExportScheduleButton
              schedule={data}
              getCells={() => cellsRef.current}
              beforeExport={() => flushRef.current()}
              disabled={rows.length === 0}
            />
            <button
              type="button"
              onClick={() => {
                setInfoError("");
                setShowInfo(true);
              }}
              className={BTN_OUTLINE}
            >
              <FiEdit2 size={16} aria-hidden="true" />
              Ubah info
            </button>
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={updateMutation.isPending}
              className={isPublished ? BTN_OUTLINE : BTN_PRIMARY}
            >
              {updateMutation.isPending ? (
                <Spinner />
              ) : isPublished ? (
                <FiEyeOff size={16} aria-hidden="true" />
              ) : (
                <FiEye size={16} aria-hidden="true" />
              )}
              {isPublished ? "Kembalikan ke draf" : "Publikasikan"}
            </button>
          </div>
        </div>

        {data.notes && (
          <p className="break-words rounded-xl bg-second/[0.03] p-4 text-sm text-second/70">
            {data.notes}
          </p>
        )}
      </header>

      {/* Ringkasan */}
      <section
        aria-label="Ringkasan jadwal"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <StatCard
          icon={FiUsers}
          label="Karyawan"
          value={rows.length}
          hint="Baris di tabel"
        />
        <StatCard
          icon={FiCalendar}
          label="Hari"
          value={data.days_in_month ?? dates.length}
          hint={formatMonth(data.month)}
        />
        <StatCard
          icon={FiEdit2}
          label="Sel terisi"
          value={`${filledCount}/${totalCells}`}
          hint="Dari seluruh sel"
        />
      </section>

      {/* Palet + tabel */}
      <section className="flex min-w-0 flex-col gap-4">
        <div className="sticky top-0 z-20 flex flex-col gap-2 rounded-2xl border border-second/30 bg-primary/90 p-4 shadow-xl shadow-second/5 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-second/60">
              Pilih item
            </span>

            {activeItems.map((item) => {
              const isSelected = selected === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item.id)}
                  aria-pressed={isSelected}
                  title={`${item.name} (${formatTimeRange(item)})`}
                  className={`rounded-xl p-0.5 transition ${FOCUS_RING} ${
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
              aria-pressed={selected === ERASE}
              className={`${BTN_BASE} h-8 border text-xs ${FOCUS_RING} ${
                selected === ERASE
                  ? "border-second2 bg-second2/10 text-second2"
                  : "border-second/30 text-second hover:border-second2 hover:text-second2"
              }`}
            >
              <FiX size={16} aria-hidden="true" />
              Kosongkan sel
            </button>

            {activeItems.length === 0 && (
              <span className="text-xs text-second2">
                Belum ada item aktif.{" "}
                <Link href={ITEMS_PATH} className="font-semibold underline">
                  Tambah item
                </Link>
              </span>
            )}
          </div>

          <SaveIndicator
            state={saveState}
            error={saveError}
            onRetry={() => flushRef.current()}
            onDiscard={handleDiscard}
          />
        </div>

        {rows.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 px-4 py-16 text-center">
            <p className="text-sm font-semibold text-second">
              Belum ada karyawan di jadwal ini
            </p>
            <p className="mt-2 text-sm text-second/60">
              Tambahkan karyawan di bagian bawah halaman.
            </p>
          </div>
        ) : (
          <div
            className={`overflow-x-auto rounded-2xl border border-second/30 bg-primary shadow-xl shadow-second/5 transition-opacity ${
              query.isFetching ? "opacity-60" : ""
            }`}
          >
            <table className="border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 min-w-40 bg-second px-4 py-2 text-left text-sm font-semibold text-primary"
                  >
                    Karyawan
                  </th>

                  {dates.map((day) => (
                    <th
                      key={day.date}
                      scope="col"
                      title={
                        day.special_dates?.length
                          ? day.special_dates.map((s) => s.name).join(", ")
                          : undefined
                      }
                      className={`h-8 w-8 min-w-8 px-0 text-center align-top font-semibold text-primary ${
                        day.is_sunday ? "bg-second2" : "bg-second"
                      }`}
                    >
                      <span className="block tabular-nums">{day.day}</span>
                      <span className="block text-[10px] font-normal leading-none opacity-80">
                        {WEEKDAYS[day.weekday]}
                      </span>
                      {day.special_dates?.length > 0 && (
                        <span className="mt-0.5 flex justify-center gap-0.5">
                          {day.special_dates.map((special) => (
                            <span
                              key={special.id}
                              aria-hidden="true"
                              className="size-1.5 rounded-full ring-1 ring-primary"
                              style={{ backgroundColor: special.color }}
                            />
                          ))}
                          <span className="sr-only">
                            {day.special_dates.map((s) => s.name).join(", ")}
                          </span>
                        </span>
                      )}
                    </th>
                  ))}

                  {summaryColumns.map((code) => (
                    <th
                      key={code}
                      scope="col"
                      className="min-w-10 bg-second px-2 text-center font-semibold text-primary"
                    >
                      {code}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  const counts = summaryFor(row);

                  return (
                    <tr key={row.schedule_employee_id}>
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-b border-r border-second/10 bg-primary px-4 py-2 text-left text-sm font-semibold text-second"
                      >
                        <span className="block max-w-48 truncate">
                          {row.employee.name}
                        </span>
                      </th>

                      {dates.map((day) => {
                        const itemId =
                          cells[cellKey(row.employee.id, day.date)];
                        const item = itemId ? itemById[itemId] : null;

                        return (
                          <td key={day.date} className="p-0">
                            <button
                              type="button"
                              title={
                                item
                                  ? `${row.employee.name}, ${day.date}: ${item.name}`
                                  : `${row.employee.name}, ${day.date}: kosong`
                              }
                              aria-label={`${row.employee.name} tanggal ${day.day}: ${
                                item ? item.code : "kosong"
                              }`}
                              onMouseDown={(event) => {
                                if (event.button !== 0) return;
                                paintingRef.current = true;
                                applyCell(row.employee.id, day.date);
                              }}
                              onMouseEnter={() => {
                                if (paintingRef.current) {
                                  applyCell(row.employee.id, day.date);
                                }
                              }}
                              onClick={() =>
                                applyCell(row.employee.id, day.date)
                              }
                              className={`flex h-8 w-8 select-none items-center justify-center border-b border-r border-second/10 text-xs font-semibold transition-opacity hover:opacity-70 ${FOCUS_RING} ${
                                !item && day.is_sunday ? "bg-second2/10" : ""
                              }`}
                              style={
                                item
                                  ? {
                                      backgroundColor: item.color,
                                      color: item.text_color,
                                    }
                                  : undefined
                              }
                            >
                              {item?.code ?? ""}
                            </button>
                          </td>
                        );
                      })}

                      {summaryColumns.map((code) => (
                        <td
                          key={code}
                          className="border-b border-r border-second/10 px-2 text-center text-xs font-semibold tabular-nums text-second"
                        >
                          {counts[code]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {specialDates.length > 0 && (
          <ul
            aria-label="Tanggal spesial"
            className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-second/70"
          >
            {specialDates.map((special) => (
              <li
                key={`${special.id}-${special.date}`}
                className="flex items-center gap-2"
              >
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: special.color }}
                />
                {formatShortDate(special.date)}: {special.name}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-second/60">
          Pilih item di atas, lalu klik atau seret di sel. Perubahan disimpan
          otomatis. Kolom rekap dihitung ulang langsung di halaman ini.
        </p>
      </section>

      <EmployeesSection
        scheduleId={id}
        rows={rows}
        onRemoved={handleEmployeeRemoved}
      />

      {/* Hapus */}
      <Card
        title="Hapus jadwal"
        description="Menghapus jadwal beserta semua baris dan isi selnya. Data karyawan dan item tidak tersentuh."
      >
        <button
          type="button"
          onClick={() => {
            setDeleteError("");
            setShowDelete(true);
          }}
          className={`${BTN_BASE} w-fit border border-second2/30 text-second2 hover:bg-second2 hover:text-primary ${FOCUS_RING}`}
        >
          <FiTrash2 size={16} aria-hidden="true" />
          Hapus jadwal
        </button>
      </Card>

      {showInfo && (
        <EditInfoDialog
          schedule={data}
          busy={updateMutation.isPending}
          error={infoError}
          onClose={() => {
            if (!updateMutation.isPending) setShowInfo(false);
          }}
          onSubmit={handleSaveInfo}
        />
      )}

      {showDelete && (
        <ConfirmDialog
          title="Hapus jadwal ini?"
          confirmLabel="Hapus permanen"
          busyLabel="Menghapus…"
          busy={deleteMutation.isPending}
          error={deleteError}
          onClose={() => {
            if (!deleteMutation.isPending) setShowDelete(false);
          }}
          onConfirm={handleDelete}
        >
          <p>
            Jadwal{" "}
            <span className="font-semibold text-second">{data.title}</span>{" "}
            dihapus permanen beserta semua isi selnya. Bulan salah? Hapus lalu
            buat ulang.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
