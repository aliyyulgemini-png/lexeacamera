"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import {
  FiCalendar,
  FiChevronRight,
  FiInbox,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";

import { useGetAdminSchedules } from "../../../features/schedules/request-hooks.js";
import {
  ADMIN_FORMS_PATH,
  ADMIN_SCHEDULES_PATH,
  ErrorPanel,
  formatDateTime,
} from "../../../../components/owner/schedule-request-shared.jsx";
import {
  BTN_OUTLINE,
  FOCUS_RING,
  currentMonth,
  describeError,
  formatMonth,
  inputClass,
  labelClass,
} from "../../../../components/owner/schedule-shared.jsx";
import notify from "../../../../lib/notify.js";

export default function AdminSchedulesPage() {
  const thisYear = Number(currentMonth().slice(0, 4));
  const years = [thisYear + 1, thisYear, thisYear - 1, thisYear - 2];

  const [year, setYear] = useState("");

  const query = useGetAdminSchedules({ year });
  const schedules = query.data ?? [];

  useEffect(() => {
    if (query.isError && query.error && query.error.response?.status !== 403) {
      notify.error(describeError(query.error));
    }
  }, [query.isError, query.error]);

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
              Jadwal <span className="text-grad">kerja</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Jadwal bulanan yang sudah dipublikasikan owner.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link href={ADMIN_FORMS_PATH} className={BTN_OUTLINE}>
            <FiInbox size={16} aria-hidden="true" />
            Request jadwal
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
        </div>
      </header>

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

        {year && (
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setYear("")}
              className={`${BTN_OUTLINE} w-full sm:w-auto`}
            >
              <FiX size={16} aria-hidden="true" />
              Reset filter
            </button>
          </div>
        )}
      </section>

      {query.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-2xl bg-second/10"
            />
          ))}
        </div>
      ) : query.isError && !query.data ? (
        <ErrorPanel
          error={query.error}
          onRetry={() => query.refetch()}
          isFetching={query.isFetching}
        />
      ) : schedules.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 px-4 py-16 text-center">
          <h2 className="text-sm font-semibold text-second">
            {year ? "Jadwal tidak ditemukan" : "Belum ada jadwal"}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-second/60">
            Jadwal muncul di sini setelah owner mempublikasikannya.
          </p>
        </div>
      ) : (
        <ul
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 ${
            query.isFetching ? "opacity-60" : ""
          }`}
        >
          {schedules.map((schedule) => (
            <li key={schedule.id}>
              <Link
                href={`${ADMIN_SCHEDULES_PATH}/${schedule.id}`}
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

                <p className="mt-auto text-xs tabular-nums text-second/60">
                  Diperbarui {formatDateTime(schedule.updated_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
