"use client";

/* Titik di header tanggal dan keterangan di bawah tabel (docs bagian 11). */

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

export function specialDateNames(day) {
  return (day.special_dates ?? []).map((special) => special.name).join(", ");
}

export function SpecialDateDots({ day }) {
  if (!day.special_dates?.length) return null;

  return (
    <span className="mt-0.5 flex justify-center gap-0.5">
      {day.special_dates.map((special) => (
        <span
          key={special.id}
          aria-hidden="true"
          className="size-1.5 rounded-full ring-1 ring-primary"
          style={{ backgroundColor: special.color }}
        />
      ))}
      <span className="sr-only">{specialDateNames(day)}</span>
    </span>
  );
}

export function SpecialDateLegend({ specialDates = [] }) {
  if (specialDates.length === 0) return null;

  return (
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
  );
}
