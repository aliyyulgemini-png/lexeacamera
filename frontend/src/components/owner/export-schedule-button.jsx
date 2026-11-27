"use client";

import { useState } from "react";
import { FiDownload } from "react-icons/fi";

import {
  BTN_OUTLINE,
  STATUS_LABEL,
  Spinner,
  WEEKDAYS,
  categoryLabel,
  describeError,
  formatMonth,
  formatTimeRange,
} from "./schedule-shared.jsx";
import notify from "../../lib/notify.js";

/* -------------------------------- Constants ------------------------------- */

/* Palet sama dengan export laporan harian: marun tua dan marun. */
const COLORS = {
  dark: "FF3A0718",
  accent: "FF6C1B30",
  onDark: "FFF0DAE1",
  white: "FFFFFFFF",
  title: "FF3A0718",
  muted: "FF666666",
  border: "FFD9D9D9",
  sunday: "FFB91C1C",
  sundayTint: "FFFDECEC",
  rowTint: "FFFAF1F4",
};

const BORDER = {
  top: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } },
};

const FIRST_DAY_COL = 3; // kolom A = No, B = Nama
const WEEKDAY_ROW = 5;
const DAY_ROW = 6;
const FIRST_DATA_ROW = 7;

/* -------------------------------- Helpers --------------------------------- */

const solid = (argb) => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});

// "#RRGGBB" -> "FFRRGGBB"
function toArgb(hex, fallback) {
  return /^#[0-9A-Fa-f]{6}$/.test(hex ?? "")
    ? `FF${hex.slice(1).toUpperCase()}`
    : fallback;
}

function colLetter(number) {
  let result = "";
  let n = number;

  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }

  return result;
}

function timestamp() {
  return `${new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} WIB`;
}

function styleHeader(cell, { sunday = false, left = false } = {}) {
  cell.fill = solid(sunday ? COLORS.sunday : COLORS.dark);
  cell.font = { bold: true, size: 10, color: { argb: COLORS.white } };
  cell.alignment = {
    vertical: "middle",
    horizontal: left ? "left" : "center",
    wrapText: true,
  };
  cell.border = BORDER;
}

async function download(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* --------------------------------- Export --------------------------------- */

async function exportScheduleExcel(schedule, cells) {
  const ExcelJS = (await import("exceljs")).default;

  const dates = schedule.dates ?? [];
  const rows = schedule.rows ?? [];
  const items = schedule.items ?? [];
  const summaryColumns = schedule.summary_columns ?? [];
  const itemById = Object.fromEntries(items.map((item) => [item.id, item]));

  if (rows.length === 0) {
    throw new Error("Belum ada karyawan di jadwal ini.");
  }

  const lastDayCol = FIRST_DAY_COL + dates.length - 1;
  const summaryStartCol = lastDayCol + 1;
  const lastCol = lastDayCol + summaryColumns.length;
  const lastDataRow = FIRST_DATA_ROW + rows.length - 1;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Jadwal Karyawan";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Jadwal", {
    views: [
      {
        state: "frozen",
        xSplit: 2,
        ySplit: DAY_ROW,
        showGridLines: false,
      },
    ],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${WEEKDAY_ROW}:${DAY_ROW}`,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    },
    headerFooter: { oddFooter: `&L${schedule.title}&RHalaman &P dari &N` },
  });

  sheet.getColumn(1).width = 5;
  sheet.getColumn(2).width = 26;
  for (let col = FIRST_DAY_COL; col <= lastDayCol; col += 1) {
    sheet.getColumn(col).width = 4.6;
  }
  for (let col = summaryStartCol; col <= lastCol; col += 1) {
    sheet.getColumn(col).width = 8;
  }

  /* ------------------------------ Judul ---------------------------------- */

  const status = STATUS_LABEL[schedule.status]?.label ?? schedule.status;

  sheet.mergeCells(1, 1, 1, lastCol);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = String(schedule.title ?? "JADWAL").toUpperCase();
  titleCell.font = { size: 18, bold: true, color: { argb: COLORS.white } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(1).height = 32;

  sheet.mergeCells(2, 1, 2, lastCol);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = `${formatMonth(schedule.month)}  · Diekspor ${timestamp()}`;
  subtitleCell.font = { size: 10, color: { argb: COLORS.onDark } };
  subtitleCell.alignment = {
    vertical: "middle",
    horizontal: "left",
    indent: 1,
  };
  sheet.getRow(2).height = 20;

  for (let col = 1; col <= lastCol; col += 1) {
    sheet.getCell(1, col).fill = solid(COLORS.dark);
    sheet.getCell(2, col).fill = solid(COLORS.dark);
  }

  sheet.mergeCells(3, 1, 3, lastCol);
  sheet.getCell(3, 1).fill = solid(COLORS.accent);
  sheet.getRow(3).height = 4;

  if (schedule.notes) {
    sheet.mergeCells(4, 1, 4, lastCol);
    const notesCell = sheet.getCell(4, 1);
    notesCell.value = `Catatan: ${schedule.notes}`;
    notesCell.font = { size: 10, italic: true, color: { argb: COLORS.muted } };
    notesCell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
    sheet.getRow(4).height = 20;
  }

  /* ------------------------------ Header --------------------------------- */

  sheet.getRow(WEEKDAY_ROW).height = 16;
  sheet.getRow(DAY_ROW).height = 18;

  sheet.mergeCells(WEEKDAY_ROW, 1, DAY_ROW, 1);
  sheet.getCell(WEEKDAY_ROW, 1).value = "No";
  sheet.mergeCells(WEEKDAY_ROW, 2, DAY_ROW, 2);
  sheet.getCell(WEEKDAY_ROW, 2).value = "Nama";

  [1, 2].forEach((col) => {
    styleHeader(sheet.getCell(WEEKDAY_ROW, col), { left: col === 2 });
    styleHeader(sheet.getCell(DAY_ROW, col), { left: col === 2 });
  });

  dates.forEach((day, index) => {
    const col = FIRST_DAY_COL + index;

    const weekdayCell = sheet.getCell(WEEKDAY_ROW, col);
    weekdayCell.value = WEEKDAYS[day.weekday];
    styleHeader(weekdayCell, { sunday: day.is_sunday });
    weekdayCell.font = {
      bold: false,
      size: 8,
      color: { argb: COLORS.white },
    };

    const dayCell = sheet.getCell(DAY_ROW, col);
    dayCell.value = day.day;
    styleHeader(dayCell, { sunday: day.is_sunday });
  });

  summaryColumns.forEach((code, index) => {
    const col = summaryStartCol + index;

    sheet.mergeCells(WEEKDAY_ROW, col, DAY_ROW, col);
    sheet.getCell(WEEKDAY_ROW, col).value = code;
    styleHeader(sheet.getCell(WEEKDAY_ROW, col));
    styleHeader(sheet.getCell(DAY_ROW, col));
  });

  /* ------------------------------- Isi ----------------------------------- */

  const firstDayLetter = colLetter(FIRST_DAY_COL);
  const lastDayLetter = colLetter(lastDayCol);

  rows.forEach((row, rowIndex) => {
    const rowNumber = FIRST_DATA_ROW + rowIndex;
    const excelRow = sheet.getRow(rowNumber);
    excelRow.height = 20;

    const numberCell = excelRow.getCell(1);
    numberCell.value = rowIndex + 1;
    numberCell.alignment = { vertical: "middle", horizontal: "center" };
    numberCell.font = { size: 10, color: { argb: COLORS.muted } };
    numberCell.border = BORDER;

    const nameCell = excelRow.getCell(2);
    nameCell.value = row.employee?.name ?? "—";
    nameCell.alignment = { vertical: "middle", horizontal: "left" };
    nameCell.font = { bold: true, size: 10, color: { argb: COLORS.title } };
    nameCell.border = BORDER;

    const counts = Object.fromEntries(summaryColumns.map((code) => [code, 0]));

    dates.forEach((day, dayIndex) => {
      const cell = excelRow.getCell(FIRST_DAY_COL + dayIndex);
      const item = itemById[cells[`${row.employee.id}|${day.date}`]];

      if (item) {
        cell.value = item.code;
        cell.fill = solid(toArgb(item.color, COLORS.white));
        cell.font = {
          bold: true,
          size: 10,
          color: { argb: toArgb(item.text_color, "FF000000") },
        };

        if (item.code in counts) counts[item.code] += 1;
      } else if (day.is_sunday) {
        cell.fill = solid(COLORS.sundayTint);
      }

      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = BORDER;
    });

    summaryColumns.forEach((code, index) => {
      const cell = excelRow.getCell(summaryStartCol + index);
      const safeCode = String(code).replace(/"/g, '""');

      cell.value = {
        formula: `COUNTIF(${firstDayLetter}${rowNumber}:${lastDayLetter}${rowNumber},"${safeCode}")`,
        result: counts[code],
      };
      cell.numFmt = "0";
      cell.fill = solid(COLORS.rowTint);
      cell.font = { bold: true, size: 10, color: { argb: COLORS.title } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = BORDER;
    });
  });

  /* ------------------------------ Legenda -------------------------------- */

  let legendRow = lastDataRow + 2;

  sheet.mergeCells(legendRow, 1, legendRow, lastCol);
  const legendTitle = sheet.getCell(legendRow, 1);
  legendTitle.value = "Keterangan";
  legendTitle.font = { bold: true, size: 11, color: { argb: COLORS.title } };
  legendTitle.alignment = { vertical: "middle", horizontal: "left" };
  legendRow += 1;

  items.forEach((item) => {
    sheet.getRow(legendRow).height = 20;

    sheet.mergeCells(legendRow, 1, legendRow, 2);
    const codeCell = sheet.getCell(legendRow, 1);
    codeCell.value = item.code;
    codeCell.fill = solid(toArgb(item.color, COLORS.white));
    codeCell.font = {
      bold: true,
      size: 10,
      color: { argb: toArgb(item.text_color, "FF000000") },
    };
    codeCell.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getCell(legendRow, 2).border = BORDER;
    codeCell.border = BORDER;

    sheet.mergeCells(legendRow, 3, legendRow, lastCol);
    const textCell = sheet.getCell(legendRow, 3);
    textCell.value = [
      item.name,
      formatTimeRange(item) !== "—" ? formatTimeRange(item) : null,
      categoryLabel(item.category),
      item.is_active ? null : "nonaktif",
    ]
      .filter(Boolean)
      .join(" · ");
    textCell.font = { size: 10, color: { argb: COLORS.title } };
    textCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    legendRow += 1;
  });

  await download(workbook, `jadwal_${schedule.month}.xlsx`);
}

/* -------------------------------- Component ------------------------------- */

/**
 * schedule: detail jadwal dari GET /owner/schedules/:id
 * getCells: () => peta { "employeeId|YYYY-MM-DD": itemId } sesuai isi layar
 * beforeExport: dipanggil dulu, misalnya untuk mengirim perubahan yang tertunda
 */
export default function ExportScheduleButton({
  schedule,
  getCells,
  beforeExport,
  disabled = false,
}) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);

    try {
      await beforeExport?.();
      await exportScheduleExcel(schedule, getCells());
      notify.success("File jadwal berhasil diunduh.");
    } catch (error) {
      notify.error(describeError(error) || "Gagal membuat file Excel.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting || disabled}
      aria-busy={exporting}
      className={BTN_OUTLINE}
    >
      {exporting ? (
        <>
          <Spinner />
          Menyiapkan…
        </>
      ) : (
        <>
          <FiDownload size={16} aria-hidden="true" />
          Export Excel
        </>
      )}
    </button>
  );
}
