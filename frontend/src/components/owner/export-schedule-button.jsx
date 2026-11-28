"use client";

import { useState } from "react";
import { FiDownload } from "react-icons/fi";

import {
  BTN_OUTLINE,
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
  dark: "#3A0718",
  accent: "#6C1B30",
  onDark: "#F0DAE1",
  white: "#FFFFFF",
  black: "#000000",
  muted: "#666666",
  border: "#D9D9D9",
  sunday: "#B91C1C",
  sundayTint: "#FDECEC",
  rowTint: "#FAF1F4",
};

const MARGIN = 8; // mm
const NO_WIDTH = 7;
const NAME_WIDTH = 34;
const SUMMARY_WIDTH = 8;

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

/* -------------------------------- Helpers --------------------------------- */

const toColor = (hex, fallback) =>
  /^#[0-9A-Fa-f]{6}$/.test(hex ?? "") ? hex : fallback;

function formatShortDate(value) {
  const [, month, day] = value.split("-").map(Number);
  return `${day} ${SHORT_MONTHS[month - 1]}`;
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

/* --------------------------------- Export --------------------------------- */

async function exportSchedulePdf(schedule, cells) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const dates = schedule.dates ?? [];
  const rows = schedule.rows ?? [];
  const items = schedule.items ?? [];
  const specialDates = schedule.special_dates ?? [];
  const summaryColumns = schedule.summary_columns ?? [];
  const itemById = Object.fromEntries(items.map((item) => [item.id, item]));

  if (rows.length === 0) {
    throw new Error("Belum ada karyawan di jadwal ini.");
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const width = pageWidth - MARGIN * 2;

  /* ------------------------------ Judul ---------------------------------- */

  doc.setFillColor(COLORS.dark);
  doc.rect(MARGIN, MARGIN, width, 16, "F");
  doc.setFillColor(COLORS.accent);
  doc.rect(MARGIN, MARGIN + 16, width, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(COLORS.white);
  doc.text(
    String(schedule.title ?? "JADWAL").toUpperCase(),
    MARGIN + 4,
    MARGIN + 7,
    {
      maxWidth: width - 8,
    },
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(COLORS.onDark);
  doc.text(
    `${formatMonth(schedule.month)}  ·  Diekspor ${timestamp()}`,
    MARGIN + 4,
    MARGIN + 12.5,
  );

  let top = MARGIN + 20;

  if (schedule.notes) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(COLORS.muted);
    const lines = doc.splitTextToSize(`Catatan: ${schedule.notes}`, width);
    doc.text(lines, MARGIN, top + 2);
    top += lines.length * 3.5 + 2;
  }

  /* ------------------------------ Tabel ---------------------------------- */

  const dayWidth =
    (width - NO_WIDTH - NAME_WIDTH - summaryColumns.length * SUMMARY_WIDTH) /
    Math.max(dates.length, 1);

  const headStyle = (sunday) => ({
    fillColor: sunday ? COLORS.sunday : COLORS.dark,
  });

  const head = [
    [
      { content: "No", rowSpan: 2 },
      { content: "Nama", rowSpan: 2, styles: { halign: "left" } },
      ...dates.map((day) => ({
        content: WEEKDAYS[day.weekday],
        styles: {
          ...headStyle(day.is_sunday),
          fontStyle: "normal",
          fontSize: 5,
        },
      })),
      ...summaryColumns.map((code) => ({ content: code, rowSpan: 2 })),
    ],
    dates.map((day) => ({
      content: String(day.day),
      styles: { ...headStyle(day.is_sunday), valign: "top", minCellHeight: 6 },
      specialDates: day.special_dates ?? [],
    })),
  ];

  const body = rows.map((row, index) => {
    const counts = Object.fromEntries(summaryColumns.map((code) => [code, 0]));

    const dayCells = dates.map((day) => {
      const item = itemById[cells[`${row.employee.id}|${day.date}`]];

      if (!item) {
        return {
          content: "",
          styles: day.is_sunday ? { fillColor: COLORS.sundayTint } : {},
        };
      }

      if (item.code in counts) counts[item.code] += 1;

      return {
        content: item.code,
        styles: {
          fillColor: toColor(item.color, COLORS.white),
          textColor: toColor(item.text_color, COLORS.black),
          fontStyle: "bold",
        },
      };
    });

    return [
      index + 1,
      {
        content: row.employee?.name ?? "-",
        styles: { halign: "left", fontStyle: "bold", overflow: "ellipsize" },
      },
      ...dayCells,
      ...summaryColumns.map((code) => ({
        content: String(counts[code]),
        styles: { fillColor: COLORS.rowTint, fontStyle: "bold" },
      })),
    ];
  });

  const columnStyles = {
    0: { cellWidth: NO_WIDTH },
    1: { cellWidth: NAME_WIDTH },
  };
  dates.forEach((_, index) => {
    columnStyles[2 + index] = { cellWidth: dayWidth };
  });
  summaryColumns.forEach((_, index) => {
    columnStyles[2 + dates.length + index] = { cellWidth: SUMMARY_WIDTH };
  });

  autoTable(doc, {
    startY: top,
    head,
    body,
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: 12 },
    rowPageBreak: "avoid",
    styles: {
      fontSize: 6,
      cellPadding: 0.4,
      halign: "center",
      valign: "middle",
      textColor: COLORS.dark,
      lineColor: COLORS.border,
      lineWidth: 0.15,
      minCellHeight: 6,
      overflow: "hidden",
    },
    headStyles: {
      fillColor: COLORS.dark,
      textColor: COLORS.white,
      minCellHeight: 4,
    },
    columnStyles,
    // Titik hari besar di header tanggal.
    didDrawCell: ({ section, cell }) => {
      const marks = cell.raw?.specialDates;
      if (section !== "head" || !marks?.length) return;

      const start = cell.x + cell.width / 2 - ((marks.length - 1) * 1.5) / 2;
      doc.setDrawColor(COLORS.white);
      doc.setLineWidth(0.2);

      marks.forEach((special, index) => {
        doc.setFillColor(toColor(special.color, "#E53935"));
        doc.circle(start + index * 1.5, cell.y + cell.height - 1.3, 0.7, "FD");
      });
    },
  });

  /* ------------------------------ Legenda -------------------------------- */

  const legendOptions = {
    theme: "plain",
    rowPageBreak: "avoid",
    margin: { left: MARGIN, right: MARGIN, bottom: 12 },
    styles: { fontSize: 7, cellPadding: 1, textColor: COLORS.dark },
    headStyles: { fontStyle: "bold", fontSize: 8 },
  };

  if (specialDates.length > 0) {
    autoTable(doc, {
      ...legendOptions,
      startY: doc.lastAutoTable.finalY + 4,
      head: [[{ content: "Hari spesial", colSpan: 2 }]],
      body: specialDates.map((special) => [
        formatShortDate(special.date),
        { content: special.name, special },
      ]),
      columnStyles: {
        0: { cellWidth: 18, cellPadding: { left: 5, top: 1, bottom: 1 } },
      },
      didDrawCell: ({ section, column, row, cell }) => {
        if (section !== "body" || column.index !== 0) return;
        doc.setFillColor(toColor(row.raw[1].special.color, "#E53935"));
        doc.circle(cell.x + 2, cell.y + cell.height / 2, 1, "F");
      },
    });
  }

  if (items.length > 0) {
    autoTable(doc, {
      ...legendOptions,
      startY: doc.lastAutoTable.finalY + 4,
      head: [[{ content: "Keterangan", colSpan: 2 }]],
      body: items.map((item) => [
        {
          content: item.code,
          styles: {
            fillColor: toColor(item.color, COLORS.white),
            textColor: toColor(item.text_color, COLORS.black),
            fontStyle: "bold",
            halign: "center",
            lineColor: COLORS.border,
            lineWidth: 0.15,
          },
        },
        [
          item.name,
          formatTimeRange(item) !== "—" ? formatTimeRange(item) : null,
          categoryLabel(item.category),
          item.is_active ? null : "nonaktif",
        ]
          .filter(Boolean)
          .join(" · ")
          .replace(/[–—]/g, "-"), // font bawaan PDF
      ]),
      columnStyles: { 0: { cellWidth: 14 } },
    });
  }

  /* ------------------------------ Footer --------------------------------- */

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(COLORS.muted);
    doc.text(
      `Halaman ${page} dari ${pages}`,
      pageWidth - MARGIN,
      pageHeight - 5,
      {
        align: "right",
      },
    );
  }

  doc.save(`jadwal_${schedule.month}.pdf`);
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
      await exportSchedulePdf(schedule, getCells());
      notify.success("File jadwal berhasil diunduh.");
    } catch (error) {
      notify.error(describeError(error) || "Gagal membuat file PDF.");
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
          Export PDF
        </>
      )}
    </button>
  );
}
