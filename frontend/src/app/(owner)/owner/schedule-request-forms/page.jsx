"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import { useRouter } from "next/navigation.js";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiChevronRight,
  FiInbox,
  FiPlus,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";

import {
  useCreateRequestForm,
  useGetRequestForms,
} from "../../../features/schedules/request-hooks.js";
import RequestFormDialog from "../../../../components/owner/schedule-request-form-dialog.jsx";
import {
  FormStateTag,
  REQUEST_FORMS_PATH,
  formatDateTime,
} from "../../../../components/owner/schedule-request-shared.jsx";
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  FOCUS_RING,
  SCHEDULES_PATH,
  Tag,
  currentMonth,
  describeError,
  extractUuid,
  formatMonth,
  inputClass,
  labelClass,
} from "../../../../components/owner/schedule-shared.jsx";
import notify from "../../../../lib/notify.js";

export default function RequestFormsPage() {
  const router = useRouter();
  const thisYear = Number(currentMonth().slice(0, 4));
  const years = [thisYear + 1, thisYear, thisYear - 1, thisYear - 2];

  const [year, setYear] = useState("");
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState("");
  const [existingId, setExistingId] = useState(null);

  const query = useGetRequestForms({ year, status });
  const createMutation = useCreateRequestForm();
  const forms = query.data ?? [];

  useEffect(() => {
    if (query.isError && query.error) notify.error(describeError(query.error));
  }, [query.isError, query.error]);

  const hasFilters = Boolean(year || status);

  async function handleCreate(payload) {
    setCreateError("");
    setExistingId(null);

    try {
      const created = await createMutation.mutateAsync(payload);
      notify.success("Form request dibuka.");
      router.push(`${REQUEST_FORMS_PATH}/${created.id}`);
    } catch (error) {
      if (error?.response?.status === 409) {
        setCreateError("Form request untuk bulan ini sudah ada.");
        setExistingId(extractUuid(error));
        return;
      }
      setCreateError(describeError(error));
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <Link
          href={SCHEDULES_PATH}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke jadwal
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
            >
              <FiInbox size={16} />
            </div>
            <div className="min-w-0">
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Request <span className="text-grad">jadwal</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                Buka form supaya karyawan bisa mengajukan OFF atau cuti sebelum
                jadwal bulan berikutnya disusun.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
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
              onClick={() => {
                setCreateError("");
                setExistingId(null);
                setShowCreate(true);
              }}
              className={BTN_PRIMARY}
            >
              <FiPlus size={16} aria-hidden="true" />
              Buka form
            </button>
          </div>
        </div>
      </header>

      {/* Filter */}
      <section
        aria-label="Filter form"
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
            <option value="OPEN">Terbuka</option>
            <option value="CLOSED">Ditutup</option>
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
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-40 animate-pulse rounded-2xl bg-second/10"
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
            Gagal memuat form request
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
      ) : forms.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 px-4 py-16 text-center">
          <h2 className="text-sm font-semibold text-second">
            {hasFilters ? "Form tidak ditemukan" : "Belum ada form request"}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-second/60">
            {hasFilters
              ? "Tidak ada form yang sesuai dengan filter."
              : "Buka form untuk bulan depan supaya karyawan bisa mengajukan request."}
          </p>
        </div>
      ) : (
        <ul
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 ${
            query.isFetching ? "opacity-60" : ""
          }`}
        >
          {forms.map((form) => {
            const counts = form.request_count ?? {};

            return (
              <li key={form.id}>
                <Link
                  href={`${REQUEST_FORMS_PATH}/${form.id}`}
                  className={`group flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 transition-colors hover:border-second4 hover:bg-second4/5 ${FOCUS_RING}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-second/60">
                        {formatMonth(form.month)}
                      </p>
                      <p className="mt-2 break-words text-sm font-bold text-second group-hover:text-second4">
                        {form.title}
                      </p>
                    </div>
                    <FiChevronRight
                      size={18}
                      className="mt-0.5 shrink-0 text-second/40"
                      aria-hidden="true"
                    />
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div className="min-w-0">
                      <dt className="text-second/60">Kuota per karyawan</dt>
                      <dd className="mt-2 font-semibold tabular-nums text-second">
                        {form.max_days_per_employee
                          ? `${form.max_days_per_employee} hari`
                          : "Tanpa batas"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-second/60">Batas waktu</dt>
                      <dd className="mt-2 font-semibold tabular-nums text-second">
                        {form.closes_at
                          ? formatDateTime(form.closes_at)
                          : "Tanpa batas"}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    <FormStateTag form={form} />
                    {Number(counts.pending) > 0 && (
                      <Tag tone="strong">{counts.pending} menunggu</Tag>
                    )}
                    <Tag tone="soft">{counts.total ?? 0} request</Tag>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {showCreate && (
        <RequestFormDialog
          month={currentMonth()}
          busy={createMutation.isPending}
          error={createError}
          extra={
            existingId ? (
              <Link
                href={`${REQUEST_FORMS_PATH}/${existingId}`}
                className={`${BTN_OUTLINE} w-fit`}
              >
                Buka form yang sudah ada
                <FiChevronRight size={16} aria-hidden="true" />
              </Link>
            ) : null
          }
          onClose={() => {
            if (!createMutation.isPending) setShowCreate(false);
          }}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}
