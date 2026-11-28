"use client";

import { Tag, WEEKDAYS } from "./schedule-shared.jsx";
import {
  SpecialDateDots,
  specialDateNames,
} from "./schedule-special-dates.jsx";

/* Penanda status untuk daftar request, bentuknya sama dengan sel tabel. */
const SHAPES = {
  PENDING: <circle cx="6" cy="6" r="5.5" fill="#EAB308" />,
  APPROVED: <rect x="1" y="1" width="10" height="10" fill="#16A34A" />,
  REJECTED: <path d="M6 .5 11.8 11H.2Z" fill="#DC2626" />,
};

export function StatusMark({ status, className = "size-3" }) {
  if (!SHAPES[status]) return null;

  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {SHAPES[status]}
    </svg>
  );
}

/* Bentuk sel menurut status, diisi warna item, tanpa garis tepi.
   PENDING  : lingkaran
   APPROVED : kotak
   REJECTED : segitiga, kode dicoret */
const CELL_SHAPES = {
  PENDING: 'circle cx="16" cy="16" r="15.5"',
  APPROVED: 'rect x="1" y="1" width="30" height="30"',
  REJECTED: 'path d="M16 1 31.5 31H.5Z"',
};

function shapeStyle(face, status) {
  // Item berwarna putih diberi abu-abu supaya bentuknya tetap terlihat.
  const fill = face.color?.toUpperCase() === "#FFFFFF" ? "#D1D5DB" : face.color;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><${CELL_SHAPES[status]} fill="${fill}"/></svg>`;

  return {
    color: face.text_color,
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundSize: "100% 100%",
  };
}

export function requestCellProps(face) {
  if (!face) return { className: "", style: undefined, label: "kosong" };

  if (face.status === "APPROVED") {
    return {
      className: "",
      style: shapeStyle(face, "APPROVED"),
      label: "disetujui",
    };
  }

  // Kode diturunkan dan dikecilkan supaya muat di bagian bawah segitiga.
  if (face.status === "REJECTED") {
    return {
      className: "line-through",
      style: { ...shapeStyle(face, "REJECTED"), paddingTop: 10, fontSize: 9 },
      label: face.owner_note ? `ditolak: ${face.owner_note}` : "ditolak",
    };
  }

  return {
    className: "",
    style: shapeStyle(face, "PENDING"),
    label: "menunggu",
  };
}

export function RequestLegend() {
  const sample = { code: "OFF", color: "#C0504D", text_color: "#FFFFFF" };

  return (
    <ul className="flex flex-wrap items-center gap-4 text-xs text-second/60">
      {[
        { status: "PENDING", label: "Menunggu" },
        { status: "APPROVED", label: "Disetujui" },
        { status: "REJECTED", label: "Ditolak" },
      ].map((entry) => {
        const props = requestCellProps({ ...sample, status: entry.status });

        return (
          <li key={entry.status} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`flex size-8 items-center justify-center text-[10px] font-semibold ${props.className}`}
              style={props.style}
            >
              OFF
            </span>
            {entry.label}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * dates, rows: dari detail form (owner 7.2 atau admin 8.4)
 * renderCell(row, day): isi sel (tombol atau kosong)
 * quotaCell(row): isi kolom kuota di kanan (opsional)
 */
export default function RequestGrid({
  dates,
  rows,
  myEmployeeId = null,
  quotaCell = null,
  renderCell,
  dimmed = false,
}) {
  return (
    <div
      className={`overflow-x-auto rounded-2xl border border-second/30 bg-primary shadow-xl shadow-second/5 transition-opacity ${
        dimmed ? "opacity-60" : ""
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

            {quotaCell && (
              <th
                scope="col"
                className="min-w-20 bg-second px-2 text-center font-semibold text-primary"
              >
                Kuota
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const isMine =
              Boolean(myEmployeeId) && row.employee.id === myEmployeeId;

            return (
              <tr key={row.employee.id}>
                <th
                  scope="row"
                  className={`sticky left-0 z-10 border-b border-r border-second/10 px-4 py-2 text-left text-sm font-semibold text-second ${
                    isMine ? "bg-second4/10" : "bg-primary"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="block max-w-40 truncate">
                      {row.employee.name}
                    </span>
                    {isMine && <Tag tone="strong">Anda</Tag>}
                  </span>
                </th>

                {dates.map((day) => (
                  <td
                    key={day.date}
                    className={`h-8 w-8 border-b border-r border-second/10 p-0 ${
                      day.is_sunday ? "bg-second2/10" : ""
                    }`}
                  >
                    {renderCell(row, day)}
                  </td>
                ))}

                {quotaCell && (
                  <td className="border-b border-r border-second/10 px-2 text-center text-xs font-semibold tabular-nums text-second">
                    {quotaCell(row)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
