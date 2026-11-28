"use client";

import { useMemo } from "react";
import Link from "next/link.js";
import { FiArrowLeft, FiCalendar, FiRefreshCw } from "react-icons/fi";

import { useGetAdminSchedule } from "../../app/features/schedules/request-hooks.js";
import ExportScheduleButton from "./export-schedule-button.jsx";
import {
  SpecialDateDots,
  SpecialDateLegend,
  specialDateNames,
} from "./schedule-special-dates.jsx";
import {
  ADMIN_SCHEDULES_PATH,
  ErrorPanel,
} from "./schedule-request-shared.jsx";
import {
  BTN_OUTLINE,
  Card,
  FOCUS_RING,
  ItemChip,
  WEEKDAYS,
  categoryLabel,
  formatMonth,
  formatTimeRange,
} from "./schedule-shared.jsx";

/* Jadwal PUBLISHED dalam mode lihat saja (admin). */
export default function ScheduleReadonlyView({
  id,
  backHref = ADMIN_SCHEDULES_PATH,
}) {
  const query = useGetAdminSchedule(id);
  const data = query.data;

  const itemById = useMemo(
    () =>
      Object.fromEntries((data?.items ?? []).map((item) => [item.id, item])),
    [data],
  );

  const backLink = (
    <Link
      href={backHref}
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

  const dates = data.dates ?? [];
  const rows = data.rows ?? [];
  const summaryColumns = data.summary_columns ?? [];

  // Peta sel untuk ekspor: { "employeeId|date": itemId }
  function buildCells() {
    const cells = {};

    for (const row of rows) {
      for (const [date, cell] of Object.entries(row.days ?? {})) {
        cells[`${row.employee.id}|${date}`] = cell.schedule_item_id;
      }
    }

    return cells;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
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
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
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
            <ExportScheduleButton
              schedule={data}
              getCells={buildCells}
              disabled={rows.length === 0}
            />
          </div>
        </div>

        {data.notes && (
          <p className="break-words rounded-xl bg-second/[0.03] p-4 text-sm text-second/70">
            {data.notes}
          </p>
        )}
      </header>

      {rows.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 px-4 py-16 text-center">
          <p className="text-sm font-semibold text-second">
            Belum ada karyawan di jadwal ini
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
                    title={specialDateNames(day) || undefined}
                    className={`h-8 w-8 min-w-8 px-0 text-center align-top font-semibold text-primary ${
                      day.is_sunday ? "bg-second2" : "bg-second"
                    }`}
                  >
                    <span className="block tabular-nums">{day.day}</span>
                    <span className="block text-[10px] font-normal leading-none opacity-80">
                      {WEEKDAYS[day.weekday]}
                    </span>
                    <SpecialDateDots day={day} />
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
              {rows.map((row) => (
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
                    const cell = row.days?.[day.date];
                    const item = cell ? itemById[cell.schedule_item_id] : null;

                    return (
                      <td
                        key={day.date}
                        title={item ? item.name : undefined}
                        className={`h-8 w-8 border-b border-r border-second/10 p-0 text-center text-xs font-semibold ${
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
                        {item?.code ?? cell?.code ?? ""}
                      </td>
                    );
                  })}

                  {summaryColumns.map((code) => (
                    <td
                      key={code}
                      className="border-b border-r border-second/10 px-2 text-center text-xs font-semibold tabular-nums text-second"
                    >
                      {row.summary?.[code] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SpecialDateLegend specialDates={data.special_dates} />

      <Card title="Keterangan">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(data.items ?? []).map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 items-center gap-4 rounded-xl border border-second/20 p-2"
            >
              <ItemChip item={item} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-second">
                  {item.name}
                </p>
                <p className="mt-1 truncate text-xs tabular-nums text-second/60">
                  {categoryLabel(item.category)} · {formatTimeRange(item)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
