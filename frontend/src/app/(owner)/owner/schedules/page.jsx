"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link.js";
import { useRouter } from "next/navigation.js";
import {
  FiAlertTriangle,
  FiCalendar,
  FiChevronRight,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSliders,
  FiUsers,
  FiX,
} from "react-icons/fi";

import {
  useCreateSchedule,
  useGetScheduleEmployeeOptions,
  useGetSchedules,
} from "../../../features/schedules/hooks.js";
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  DialogHeader,
  ErrorText,
  FOCUS_RING,
  FormError,
  ITEMS_PATH,
  MONTH_RE,
  Modal,
  SCHEDULES_PATH,
  STATUS_LABEL,
  Spinner,
  Tag,
  currentMonth,
  describeError,
  extractUuid,
  formatMonth,
  inputClass,
  labelClass,
} from "../../../../components/owner/schedule-shared.jsx";
import notify from "../../../../lib/notify.js";

/* ------------------------------ Create dialog ----------------------------- */

function CreateScheduleDialog({ onClose }) {
  const router = useRouter();
  const createMutation = useCreateSchedule();
  const employeesQuery = useGetScheduleEmployeeOptions(true);

  const [month, setMonth] = useState(currentMonth());
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [initialized, setInitialized] = useState(false);
  const [errors, setErrors] = useState({});
  const [existingId, setExistingId] = useState(null);

  const employees = useMemo(
    () => employeesQuery.data ?? [],
    [employeesQuery.data],
  );

  // Semua karyawan tercentang di awal.
  useEffect(() => {
    if (initialized || employees.length === 0) return;
    setSelected(new Set(employees.map((employee) => employee.id)));
    setInitialized(true);
  }, [employees, initialized]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) =>
      String(employee.name ?? "")
        .toLowerCase()
        .includes(term),
    );
  }, [employees, search]);

  const busy = createMutation.isPending;

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setErrors((current) => ({ ...current, employees: undefined }));
  }

  function setVisible(checked) {
    setSelected((current) => {
      const next = new Set(current);
      for (const employee of visible) {
        if (checked) next.add(employee.id);
        else next.delete(employee.id);
      }
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const found = {};

    if (!MONTH_RE.test(month)) found.month = "Isi bulan dengan format YYYY-MM.";
    if (selected.size === 0) found.employees = "Pilih minimal 1 karyawan.";
    if (title.trim().length > 150) found.title = "Judul maksimal 150 karakter.";

    setErrors(found);
    setExistingId(null);
    if (Object.keys(found).length > 0) return;

    // Urutan baris mengikuti urutan daftar karyawan.
    const payload = {
      month,
      employee_ids: employees
        .filter((employee) => selected.has(employee.id))
        .map((employee) => employee.id),
      ...(title.trim() && { title: title.trim() }),
      ...(notes.trim() && { notes: notes.trim() }),
    };

    try {
      const schedule = await createMutation.mutateAsync(payload);
      notify.success("Jadwal dibuat.");
      router.push(`${SCHEDULES_PATH}/${schedule.id}`);
    } catch (error) {
      if (error?.response?.status === 409) {
        setExistingId(extractUuid(error));
        setErrors({
          month: `Jadwal ${formatMonth(month)} sudah ada.`,
        });
        return;
      }
      setErrors({ form: describeError(error) });
    }
  }

  return (
    <Modal titleId="create-schedule-title" onClose={onClose} busy={busy} wide>
      <form onSubmit={handleSubmit} noValidate>
        <DialogHeader icon={FiPlus} onClose={onClose} busy={busy} />

        <h2
          id="create-schedule-title"
          className="mt-4 text-lg font-bold text-second"
        >
          Buat jadwal baru
        </h2>
        <p className="mt-2 text-sm text-second/60">
          Satu bulan hanya punya satu jadwal. Semua sel masih kosong setelah
          dibuat.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <div className="min-w-0">
            <label htmlFor="schedule-month" className={labelClass}>
              Bulan
              <span className="ml-2 text-second2" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="schedule-month"
              type="month"
              value={month}
              disabled={busy}
              placeholder="2026-12"
              onChange={(event) => {
                setMonth(event.target.value);
                setExistingId(null);
                setErrors((current) => ({ ...current, month: undefined }));
              }}
              aria-invalid={errors.month ? "true" : undefined}
              className={`${inputClass(Boolean(errors.month))} tabular-nums`}
            />
            {errors.month && <ErrorText>{errors.month}</ErrorText>}
            {existingId && (
              <Link
                href={`${SCHEDULES_PATH}/${existingId}`}
                className={`${BTN_OUTLINE} mt-2 w-fit`}
              >
                Buka jadwal yang sudah ada
                <FiChevronRight size={16} aria-hidden="true" />
              </Link>
            )}
          </div>

          <div className="min-w-0">
            <label htmlFor="schedule-title" className={labelClass}>
              Judul
              <span className="ml-2 text-xs font-normal text-second/50">
                Opsional
              </span>
            </label>
            <input
              id="schedule-title"
              value={title}
              maxLength={150}
              disabled={busy}
              autoComplete="off"
              placeholder={`SCHEDULE ${formatMonth(month).toUpperCase()}`}
              onChange={(event) => setTitle(event.target.value)}
              className={inputClass(Boolean(errors.title))}
            />
            {errors.title ? (
              <ErrorText>{errors.title}</ErrorText>
            ) : (
              <p className="mt-2 text-xs text-second/60">
                Dikosongkan = judul otomatis.
              </p>
            )}
          </div>

          <div className="min-w-0">
            <label htmlFor="schedule-notes" className={labelClass}>
              Catatan
              <span className="ml-2 text-xs font-normal text-second/50">
                Opsional
              </span>
            </label>
            <textarea
              id="schedule-notes"
              rows={2}
              value={notes}
              disabled={busy}
              onChange={(event) => setNotes(event.target.value)}
              className={inputClass(false)}
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={`${labelClass} !mb-0`}>
                Karyawan
                <span className="ml-2 text-second2" aria-hidden="true">
                  *
                </span>
              </p>
              <Tag tone="soft">
                {selected.size}/{employees.length} dipilih
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
                onClick={() => setVisible(true)}
                disabled={busy || visible.length === 0}
                className={`${BTN_OUTLINE} !px-2 !py-1 text-xs`}
              >
                Pilih semua
              </button>
              <button
                type="button"
                onClick={() => setVisible(false)}
                disabled={busy || visible.length === 0}
                className={`${BTN_OUTLINE} !px-2 !py-1 text-xs`}
              >
                Kosongkan
              </button>
            </div>

            <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-second/30">
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
              ) : visible.length === 0 ? (
                <p className="p-4 text-sm text-second/60">
                  {employees.length === 0
                    ? "Belum ada karyawan."
                    : "Tidak ada karyawan yang cocok."}
                </p>
              ) : (
                <ul className="divide-y divide-second/10">
                  {visible.map((employee) => (
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
            {errors.employees && <ErrorText>{errors.employees}</ErrorText>}
          </div>

          {errors.form && <FormError>{errors.form}</FormError>}
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
            disabled={busy || employeesQuery.isPending}
            aria-busy={busy}
            className={`${BTN_PRIMARY} w-full sm:w-auto`}
          >
            {busy ? (
              <>
                <Spinner />
                Membuat…
              </>
            ) : (
              "Buat jadwal"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function SchedulesPage() {
  const thisYear = Number(currentMonth().slice(0, 4));
  const years = [thisYear + 1, thisYear, thisYear - 1, thisYear - 2];

  const [year, setYear] = useState("");
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const query = useGetSchedules({ year, status });
  const schedules = query.data ?? [];

  useEffect(() => {
    if (query.isError && query.error) notify.error(describeError(query.error));
  }, [query.isError, query.error]);

  const hasFilters = Boolean(year || status);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiCalendar size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Jadwal <span className="text-grad">karyawan</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Jadwal shift bulanan. Satu bulan hanya punya satu jadwal.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link href={ITEMS_PATH} className={BTN_OUTLINE}>
            <FiSliders size={16} aria-hidden="true" />
            Item jadwal
          </Link>
          <button
            type="button"
            onClick={() => query.refetch()}
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
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className={BTN_PRIMARY}
          >
            <FiPlus size={16} aria-hidden="true" />
            Buat jadwal
          </button>
        </div>
      </header>

      {/* Filter */}
      <section
        aria-label="Filter jadwal"
        className="grid grid-cols-1 gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:grid-cols-3 sm:p-8"
      >
        <div className="min-w-0">
          <label htmlFor="filter-year" className={labelClass}>
            Tahun
          </label>
          <select
            id="filter-year"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className={`${inputClass(false)} tabular-nums`}
          >
            <option value="">Semua</option>
            {years.map((value) => (
              <option key={value} value={String(value)}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="filter-status" className={labelClass}>
            Status
          </label>
          <select
            id="filter-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={inputClass(false)}
          >
            <option value="">Semua</option>
            <option value="DRAFT">Draf</option>
            <option value="PUBLISHED">Dipublikasikan</option>
          </select>
        </div>

        {hasFilters && (
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setYear("");
                setStatus("");
              }}
              className={`${BTN_OUTLINE} w-full sm:w-auto`}
            >
              <FiX size={16} aria-hidden="true" />
              Reset filter
            </button>
          </div>
        )}
      </section>

      {/* Daftar */}
      {query.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-2xl bg-second/10"
            />
          ))}
        </div>
      ) : query.isError && !query.data ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <FiAlertTriangle
            size={32}
            className="text-second2"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-second">
            Gagal memuat jadwal
          </h2>
          <button
            type="button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className={`${BTN_PRIMARY} mt-4`}
          >
            <FiRefreshCw size={16} aria-hidden="true" />
            {query.isFetching ? "Memuat…" : "Coba lagi"}
          </button>
        </div>
      ) : schedules.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 px-4 py-16 text-center">
          <h2 className="text-sm font-semibold text-second">
            {hasFilters ? "Jadwal tidak ditemukan" : "Belum ada jadwal"}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-second/60">
            {hasFilters
              ? "Tidak ada jadwal yang sesuai dengan filter."
              : "Buat jadwal pertama dengan memilih bulan dan karyawan."}
          </p>
        </div>
      ) : (
        <ul
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 ${
            query.isFetching ? "opacity-60" : ""
          }`}
        >
          {schedules.map((schedule) => {
            const status = STATUS_LABEL[schedule.status] ?? {
              label: schedule.status,
              tone: "outline",
            };

            return (
              <li key={schedule.id}>
                <Link
                  href={`${SCHEDULES_PATH}/${schedule.id}`}
                  className={`group flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 transition-colors hover:border-second4 hover:bg-second4/5 ${FOCUS_RING}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-second/60">
                        {formatMonth(schedule.month)}
                      </p>
                      <p className="mt-2 break-words text-sm font-bold text-second group-hover:text-second4">
                        {schedule.title}
                      </p>
                    </div>
                    <FiChevronRight
                      size={18}
                      className="mt-0.5 shrink-0 text-second/40"
                      aria-hidden="true"
                    />
                  </div>

                  {schedule.notes && (
                    <p className="line-clamp-2 break-words text-xs text-second/60">
                      {schedule.notes}
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    <Tag tone="soft">
                      <FiUsers size={12} aria-hidden="true" />
                      <span className="ml-2 tabular-nums">
                        {schedule.employee_count} karyawan
                      </span>
                    </Tag>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {showCreate && (
        <CreateScheduleDialog onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
