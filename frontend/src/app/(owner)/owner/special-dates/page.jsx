"use client";

import { useState } from "react";
import Link from "next/link.js";
import {
  FiArrowLeft,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
} from "react-icons/fi";

import {
  useCreateSpecialDate,
  useDeleteSpecialDate,
  useGetSpecialDates,
  useUpdateSpecialDate,
} from "../../../features/special-dates/hooks.js";
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  ConfirmDialog,
  DialogHeader,
  ErrorText,
  FOCUS_RING,
  FormError,
  Modal,
  SCHEDULES_PATH,
  Spinner,
  Tag,
  currentMonth,
  describeError,
  inputClass,
  labelClass,
} from "../../../../components/owner/schedule-shared.jsx";
import notify from "../../../../lib/notify.js";

const DEFAULT_COLOR = "#E53935";

const MONTHS = [
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

// Yang berulang ditampilkan tanpa tahun. Tanpa new Date() agar bebas zona waktu.
function formatDate({ date, is_yearly }) {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  const text = `${day} ${MONTHS[month - 1]}`;
  return is_yearly ? `${text} (tiap tahun)` : `${text} ${year}`;
}

function SpecialDateDialog({ item, onClose }) {
  const createMutation = useCreateSpecialDate();
  const updateMutation = useUpdateSpecialDate();
  const busy = createMutation.isPending || updateMutation.isPending;

  const [date, setDate] = useState(item?.date.slice(0, 10) ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [color, setColor] = useState(item?.color ?? DEFAULT_COLOR);
  const [yearly, setYearly] = useState(item?.is_yearly ?? false);
  const [errors, setErrors] = useState({});

  async function handleSubmit(event) {
    event.preventDefault();

    const found = {};
    if (!date) found.date = "Tanggal wajib diisi.";
    if (!name.trim()) found.name = "Nama wajib diisi.";
    else if (name.trim().length > 100)
      found.name = "Nama maksimal 100 karakter.";

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const data = { date, name: name.trim(), color, is_yearly: yearly };

    try {
      if (item) await updateMutation.mutateAsync({ id: item.id, data });
      else await createMutation.mutateAsync(data);

      notify.success(
        item ? "Hari spesial diperbarui." : "Hari spesial ditambahkan.",
      );
      onClose();
    } catch (error) {
      setErrors({ form: describeError(error) });
    }
  }

  return (
    <Modal titleId="special-date-title" onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit} noValidate>
        <DialogHeader
          icon={item ? FiEdit2 : FiPlus}
          onClose={onClose}
          busy={busy}
        />

        <h2
          id="special-date-title"
          className="mt-4 text-lg font-bold text-second"
        >
          {item ? "Ubah hari spesial" : "Tambah hari spesial"}
        </h2>

        <div className="mt-8 flex flex-col gap-4">
          <div className="min-w-0">
            <label htmlFor="special-date" className={labelClass}>
              Tanggal
            </label>
            <input
              id="special-date"
              type="date"
              value={date}
              disabled={busy}
              onChange={(event) => setDate(event.target.value)}
              className={`${inputClass(Boolean(errors.date))} tabular-nums`}
            />
            {errors.date && <ErrorText>{errors.date}</ErrorText>}
          </div>

          <div className="min-w-0">
            <label htmlFor="special-name" className={labelClass}>
              Nama
            </label>
            <input
              id="special-name"
              value={name}
              maxLength={100}
              disabled={busy}
              autoComplete="off"
              placeholder="Natal, 12.12, Promo Akhir Tahun"
              onChange={(event) => setName(event.target.value)}
              className={inputClass(Boolean(errors.name))}
            />
            {errors.name && <ErrorText>{errors.name}</ErrorText>}
          </div>

          <div className="min-w-0">
            <label htmlFor="special-color" className={labelClass}>
              Warna titik
            </label>
            <input
              id="special-color"
              type="color"
              value={color}
              disabled={busy}
              onChange={(event) => setColor(event.target.value.toUpperCase())}
              className={`h-10 w-16 cursor-pointer rounded-xl border border-second/30 ${FOCUS_RING}`}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-4">
            <input
              type="checkbox"
              checked={yearly}
              disabled={busy}
              onChange={(event) => setYearly(event.target.checked)}
              className={`mt-0.5 size-4 shrink-0 accent-second4 ${FOCUS_RING}`}
            />
            <span className="text-sm text-second">
              Berulang tiap tahun
              <span className="mt-1 block text-xs text-second/60">
                Matikan untuk hari besar yang tanggalnya berubah, seperti Idul
                Fitri, Imlek, atau Nyepi.
              </span>
            </span>
          </label>

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

export default function SpecialDatesPage() {
  const thisYear = Number(currentMonth().slice(0, 4));
  const years = [thisYear + 1, thisYear, thisYear - 1];

  const [year, setYear] = useState(String(thisYear));
  const [editing, setEditing] = useState(null); // null | "new" | item
  const [toDelete, setToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const query = useGetSpecialDates(year);
  const deleteMutation = useDeleteSpecialDate();

  // Urut bulan-tanggal bila satu tahun dipilih, urut tanggal penuh bila semua.
  const sortKey = (item) => item.date.slice(year ? 5 : 0, 10);
  const items = [...(query.data ?? [])].sort((a, b) =>
    sortKey(a).localeCompare(sortKey(b)),
  );

  async function handleDelete() {
    setDeleteError("");

    try {
      await deleteMutation.mutateAsync(toDelete.id);
      notify.success("Hari spesial dihapus.");
      setToDelete(null);
    } catch (error) {
      setDeleteError(describeError(error));
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <Link
          href={SCHEDULES_PATH}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 hover:text-second4 ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke daftar jadwal
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Hari <span className="text-grad">spesial</span>
            </h1>
            <p className="mt-2 text-sm text-second/60">
              Hari besar, tanggal kembar, dan event toko. Muncul sebagai titik
              di tabel jadwal dan form request.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className={BTN_PRIMARY}
          >
            <FiPlus size={16} aria-hidden="true" />
            Tambah hari spesial
          </button>
        </div>
      </header>

      <div className="w-full sm:w-48">
        <label htmlFor="special-year" className={labelClass}>
          Tahun
        </label>
        <select
          id="special-year"
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

      {query.isPending ? (
        <div className="h-48 animate-pulse rounded-2xl bg-second/10" />
      ) : query.isError && !query.data ? (
        <div role="alert" className="flex flex-col items-start gap-4">
          <p className="text-sm text-second2">{describeError(query.error)}</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className={BTN_OUTLINE}
          >
            <FiRefreshCw size={16} aria-hidden="true" />
            Coba lagi
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-second/20 px-4 py-16 text-center text-sm text-second/60">
          Belum ada hari spesial.
        </p>
      ) : (
        <ul className="divide-y divide-second/10 rounded-2xl border border-second/30">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div className="flex min-w-0 items-center gap-4">
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-second">
                    {item.name}
                  </p>
                  <div className="mt-2">
                    <Tag tone="soft">{formatDate(item)}</Tag>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  aria-label={`Ubah ${item.name}`}
                  className={`${BTN_OUTLINE} !px-2`}
                >
                  <FiEdit2 size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError("");
                    setToDelete(item);
                  }}
                  aria-label={`Hapus ${item.name}`}
                  className={`${BTN_OUTLINE} !px-2`}
                >
                  <FiTrash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <SpecialDateDialog
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Hapus hari spesial?"
          confirmLabel="Hapus"
          busyLabel="Menghapus…"
          busy={deleteMutation.isPending}
          error={deleteError}
          onClose={() => {
            if (!deleteMutation.isPending) setToDelete(null);
          }}
          onConfirm={handleDelete}
        >
          <p>
            <span className="font-semibold text-second">{toDelete.name}</span> (
            {formatDate(toDelete)}) akan dihapus.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
