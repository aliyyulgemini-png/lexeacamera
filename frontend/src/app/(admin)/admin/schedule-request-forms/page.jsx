"use client";

import { useEffect } from "react";
import Link from "next/link.js";
import {
  FiArrowLeft,
  FiChevronRight,
  FiInbox,
  FiRefreshCw,
} from "react-icons/fi";

import { useGetAdminRequestForms } from "../../../features/schedules/request-hooks.js";
import {
  ADMIN_FORMS_PATH,
  ADMIN_SCHEDULES_PATH,
  ErrorPanel,
  FormStateTag,
  formatDateTime,
} from "../../../../components/owner/schedule-request-shared.jsx";
import {
  BTN_OUTLINE,
  FOCUS_RING,
  Tag,
  describeError,
  formatMonth,
} from "../../../../components/owner/schedule-shared.jsx";
import notify from "../../../../lib/notify.js";

export default function AdminRequestFormsPage() {
  const query = useGetAdminRequestForms();
  const forms = query.data ?? [];

  useEffect(() => {
    if (query.isError && query.error && query.error.response?.status !== 403) {
      notify.error(describeError(query.error));
    }
  }, [query.isError, query.error]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <Link
          href={ADMIN_SCHEDULES_PATH}
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
                Isi OFF atau cuti karyawan untuk bulan yang dibuka owner.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => query.refetch()}
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
      </header>

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
        <ErrorPanel
          error={query.error}
          onRetry={() => query.refetch()}
          isFetching={query.isFetching}
        />
      ) : forms.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 px-4 py-16 text-center">
          <h2 className="text-sm font-semibold text-second">
            Belum ada form request
          </h2>
          <p className="mt-2 max-w-sm text-sm text-second/60">
            Form akan muncul di sini setelah owner membukanya.
          </p>
        </div>
      ) : (
        <ul
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 ${
            query.isFetching ? "opacity-60" : ""
          }`}
        >
          {forms.map((form) => {
            // quota null = akun admin tidak terhubung ke data karyawan.
            const quota = form.quota;

            return (
              <li key={form.id}>
                <Link
                  href={`${ADMIN_FORMS_PATH}/${form.id}`}
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

                  {form.description && (
                    <p className="line-clamp-2 break-words text-xs text-second/60">
                      {form.description}
                    </p>
                  )}

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
                    <Tag tone="soft">{form.employee_count ?? 0} karyawan</Tag>
                    {quota && quota.max != null && (
                      <Tag tone="strong">Sisa kuota Anda {quota.remaining}</Tag>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
