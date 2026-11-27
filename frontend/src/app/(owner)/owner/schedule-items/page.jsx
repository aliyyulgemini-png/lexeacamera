"use client";

import { useEffect, useState } from "react";
import Link from "next/link.js";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiSliders,
  FiTrash2,
  FiX,
} from "react-icons/fi";

import {
  useCreateScheduleItem,
  useDeleteScheduleItem,
  useGetScheduleItems,
  useUpdateScheduleItem,
} from "../../../features/schedules/hooks.js";
import {
  BTN_BASE,
  BTN_OUTLINE,
  BTN_PRIMARY,
  CATEGORIES,
  ConfirmDialog,
  DialogHeader,
  ErrorText,
  FOCUS_RING,
  FormError,
  HEX_RE,
  ItemChip,
  Modal,
  SCHEDULES_PATH,
  Spinner,
  Switch,
  Tag,
  TIME_RE,
  categoryLabel,
  describeError,
  formatTimeRange,
  inputClass,
  labelClass,
} from "../../../../components/owner/schedule-shared.jsx";
import notify from "../../../../lib/notify.js";

/* ------------------------------ Form dialog ------------------------------- */

function ColorField({ id, label, value, onChange, disabled, error }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} (pemilih warna)`}
          value={HEX_RE.test(value) ? value : "#FFFFFF"}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="size-8 shrink-0 cursor-pointer rounded-xl border border-second/30 bg-primary p-0 disabled:opacity-50"
        />
        <input
          id={id}
          value={value}
          maxLength={7}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) =>
            onChange(event.target.value.toUpperCase().slice(0, 7))
          }
          aria-invalid={error ? "true" : undefined}
          className={`${inputClass(Boolean(error))} font-mono`}
        />
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function ItemFormDialog({ item, busy, error, onClose, onSubmit }) {
  const isEdit = Boolean(item);

  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "SHIFT");
  const [startTime, setStartTime] = useState(item?.start_time ?? "");
  const [endTime, setEndTime] = useState(item?.end_time ?? "");
  const [color, setColor] = useState(item?.color ?? "#FFFFFF");
  const [textColor, setTextColor] = useState(item?.text_color ?? "#000000");
  const [showInSummary, setShowInSummary] = useState(
    item?.show_in_summary ?? false,
  );
  const [sortOrder, setSortOrder] = useState(
    item ? String(item.sort_order ?? 0) : "",
  );
  const [errors, setErrors] = useState({});

  function clear(field) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const found = {};

    if (!code.trim()) found.code = "Kode wajib diisi.";
    if (!name.trim()) found.name = "Keterangan wajib diisi.";
    if (startTime && !TIME_RE.test(startTime)) {
      found.startTime = "Format jam HH:mm.";
    }
    if (endTime && !TIME_RE.test(endTime)) found.endTime = "Format jam HH:mm.";
    if (!HEX_RE.test(color)) found.color = "Format warna #RRGGBB.";
    if (!HEX_RE.test(textColor)) found.textColor = "Format warna #RRGGBB.";
    if (
      sortOrder !== "" &&
      (!/^\d+$/.test(sortOrder) || Number(sortOrder) > 100000)
    ) {
      found.sortOrder = "Isi angka 0 sampai 100000.";
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const next = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      category,
      start_time: startTime || null,
      end_time: endTime || null,
      color,
      text_color: textColor,
      show_in_summary: showInSummary,
    };

    if (sortOrder !== "") next.sort_order = Number(sortOrder);

    if (!isEdit) {
      onSubmit(next);
      return;
    }

    // Edit: kirim hanya yang berubah.
    const changed = {};
    for (const [key, value] of Object.entries(next)) {
      if (value !== (item[key] ?? null)) changed[key] = value;
    }

    if (Object.keys(changed).length === 0) {
      onClose();
      return;
    }

    onSubmit(changed);
  }

  const preview = {
    code: code.trim().toUpperCase() || "KODE",
    color: HEX_RE.test(color) ? color : "#FFFFFF",
    text_color: HEX_RE.test(textColor) ? textColor : "#000000",
  };

  return (
    <Modal titleId="item-form-title" onClose={onClose} busy={busy} wide>
      <form onSubmit={handleSubmit} noValidate>
        <DialogHeader
          icon={isEdit ? FiEdit2 : FiPlus}
          onClose={onClose}
          busy={busy}
        />

        <h2 id="item-form-title" className="mt-4 text-lg font-bold text-second">
          {isEdit ? "Ubah item jadwal" : "Tambah item jadwal"}
        </h2>

        <div className="mt-8 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="min-w-0">
              <label htmlFor="item-code" className={labelClass}>
                Kode
                <span className="ml-2 text-second2" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="item-code"
                value={code}
                maxLength={10}
                disabled={busy}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder="P"
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase().replace(/\s/g, ""));
                  clear("code");
                }}
                aria-invalid={errors.code ? "true" : undefined}
                className={`${inputClass(Boolean(errors.code))} font-mono`}
              />
              {errors.code && <ErrorText>{errors.code}</ErrorText>}
            </div>

            <div className="min-w-0 sm:col-span-2">
              <label htmlFor="item-name" className={labelClass}>
                Keterangan
                <span className="ml-2 text-second2" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="item-name"
                value={name}
                maxLength={100}
                disabled={busy}
                autoComplete="off"
                placeholder="Shift Pagi"
                onChange={(event) => {
                  setName(event.target.value);
                  clear("name");
                }}
                aria-invalid={errors.name ? "true" : undefined}
                className={inputClass(Boolean(errors.name))}
              />
              {errors.name && <ErrorText>{errors.name}</ErrorText>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="min-w-0">
              <label htmlFor="item-category" className={labelClass}>
                Kategori
              </label>
              <select
                id="item-category"
                value={category}
                disabled={busy}
                onChange={(event) => setCategory(event.target.value)}
                className={inputClass(false)}
              >
                {CATEGORIES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="item-start" className={labelClass}>
                Jam mulai
              </label>
              <input
                id="item-start"
                type="time"
                value={startTime}
                disabled={busy}
                onChange={(event) => {
                  setStartTime(event.target.value);
                  clear("startTime");
                }}
                aria-invalid={errors.startTime ? "true" : undefined}
                className={`${inputClass(Boolean(errors.startTime))} tabular-nums`}
              />
              {errors.startTime && <ErrorText>{errors.startTime}</ErrorText>}
            </div>

            <div className="min-w-0">
              <label htmlFor="item-end" className={labelClass}>
                Jam selesai
              </label>
              <input
                id="item-end"
                type="time"
                value={endTime}
                disabled={busy}
                onChange={(event) => {
                  setEndTime(event.target.value);
                  clear("endTime");
                }}
                aria-invalid={errors.endTime ? "true" : undefined}
                className={`${inputClass(Boolean(errors.endTime))} tabular-nums`}
              />
              {errors.endTime && <ErrorText>{errors.endTime}</ErrorText>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ColorField
              id="item-color"
              label="Warna latar"
              value={color}
              disabled={busy}
              error={errors.color}
              onChange={(value) => {
                setColor(value);
                clear("color");
              }}
            />
            <ColorField
              id="item-text-color"
              label="Warna teks"
              value={textColor}
              disabled={busy}
              error={errors.textColor}
              onChange={(value) => {
                setTextColor(value);
                clear("textColor");
              }}
            />
          </div>

          <div className="flex items-center gap-4 rounded-xl bg-second/[0.03] p-4">
            <p className="text-xs text-second/60">Pratinjau sel</p>
            <ItemChip item={preview} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-4 rounded-xl border border-second/30 p-4">
              <input
                type="checkbox"
                checked={showInSummary}
                disabled={busy}
                onChange={(event) => setShowInSummary(event.target.checked)}
                className={`mt-0.5 size-4 shrink-0 cursor-pointer accent-second4 ${FOCUS_RING}`}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-second">
                  Hitung di kolom rekap
                </span>
                <span className="mt-2 block text-xs text-second/60">
                  Jadi kolom di kanan tabel, misalnya OFF, PIK, AL.
                </span>
              </span>
            </label>

            <div className="min-w-0">
              <label htmlFor="item-sort" className={labelClass}>
                Urutan
                <span className="ml-2 text-xs font-normal text-second/50">
                  Opsional
                </span>
              </label>
              <input
                id="item-sort"
                inputMode="numeric"
                value={sortOrder}
                disabled={busy}
                autoComplete="off"
                placeholder="Otomatis di urutan terakhir"
                onChange={(event) => {
                  setSortOrder(event.target.value.replace(/\D/g, ""));
                  clear("sortOrder");
                }}
                aria-invalid={errors.sortOrder ? "true" : undefined}
                className={`${inputClass(Boolean(errors.sortOrder))} tabular-nums`}
              />
              {errors.sortOrder && <ErrorText>{errors.sortOrder}</ErrorText>}
            </div>
          </div>

          {isEdit && (
            <p className="text-xs leading-relaxed text-second/60">
              Mengubah kode, nama, atau warna langsung berlaku di semua jadwal.
            </p>
          )}

          {error && <FormError>{error}</FormError>}
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

/* ---------------------------------- Page --------------------------------- */

export default function ScheduleItemsPage() {
  const [category, setCategory] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const query = useGetScheduleItems({
    category,
    is_active: activeFilter,
  });
  const items = query.data ?? [];

  const createMutation = useCreateScheduleItem();
  const updateMutation = useUpdateScheduleItem();
  const deleteMutation = useDeleteScheduleItem();

  // null = tertutup, "new" = tambah, objek = ubah
  const [formTarget, setFormTarget] = useState(null);
  const [formError, setFormError] = useState("");
  const [toDelete, setToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteConflict, setDeleteConflict] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    if (query.isError && query.error) notify.error(describeError(query.error));
  }, [query.isError, query.error]);

  const hasFilters = Boolean(category || activeFilter);

  async function handleSubmit(data) {
    setFormError("");

    try {
      if (formTarget === "new") {
        await createMutation.mutateAsync(data);
        notify.success("Item jadwal ditambahkan.");
      } else {
        await updateMutation.mutateAsync({ id: formTarget.id, data });
        notify.success("Item jadwal diperbarui.");
      }
      setFormTarget(null);
    } catch (error) {
      setFormError(
        error?.response?.status === 409
          ? "Kode ini sudah dipakai item lain."
          : describeError(error),
      );
    }
  }

  async function handleToggle(item, isActive) {
    setTogglingId(item.id);

    try {
      await updateMutation.mutateAsync({
        id: item.id,
        data: { is_active: isActive },
      });
      notify.success(
        isActive
          ? "Item diaktifkan."
          : "Item dinonaktifkan. Sel lama tetap tampil normal.",
      );
    } catch (error) {
      notify.error(describeError(error));
    } finally {
      setTogglingId(null);
    }
  }

  function openDelete(item) {
    setDeleteError("");
    setDeleteConflict(false);
    setToDelete(item);
  }

  async function handleDelete() {
    setDeleteError("");

    try {
      await deleteMutation.mutateAsync(toDelete.id);
      notify.success("Item dihapus.");
      setToDelete(null);
    } catch (error) {
      if (error?.response?.status === 409) {
        setDeleteConflict(true);
        setDeleteError(
          "Item ini masih dipakai di jadwal, jadi tidak bisa dihapus. Nonaktifkan saja supaya tidak muncul sebagai pilihan.",
        );
        return;
      }
      setDeleteError(describeError(error));
    }
  }

  async function handleDeactivateInstead() {
    try {
      await updateMutation.mutateAsync({
        id: toDelete.id,
        data: { is_active: false },
      });
      notify.success("Item dinonaktifkan.");
      setToDelete(null);
    } catch (error) {
      setDeleteError(describeError(error));
    }
  }

  const savingForm = createMutation.isPending || updateMutation.isPending;

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
              <FiSliders size={16} />
            </div>
            <div className="min-w-0">
              <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
                Item <span className="text-grad">jadwal</span>
              </h1>
              <p className="mt-2 text-pretty text-sm text-second/60">
                Kode yang dipilih untuk mengisi sel jadwal: P, S, AL, OFF, dan
                lainnya.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
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
            <button
              type="button"
              onClick={() => {
                setFormError("");
                setFormTarget("new");
              }}
              className={`${BTN_PRIMARY} w-full sm:w-auto`}
            >
              <FiPlus size={16} aria-hidden="true" />
              Tambah item
            </button>
          </div>
        </div>
      </header>

      {/* Filter */}
      <section
        aria-label="Filter item"
        className="grid grid-cols-1 gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:grid-cols-3 sm:p-8"
      >
        <div className="min-w-0">
          <label htmlFor="filter-category" className={labelClass}>
            Kategori
          </label>
          <select
            id="filter-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={inputClass(false)}
          >
            <option value="">Semua</option>
            {CATEGORIES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="filter-active" className={labelClass}>
            Status
          </label>
          <select
            id="filter-active"
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value)}
            className={inputClass(false)}
          >
            <option value="">Semua</option>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
        </div>

        {hasFilters && (
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setCategory("");
                setActiveFilter("");
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
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-2xl bg-second/10"
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
            Gagal memuat item jadwal
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
      ) : items.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-second/20 px-4 py-16 text-center">
          <h2 className="text-sm font-semibold text-second">
            {hasFilters ? "Item tidak ditemukan" : "Belum ada item jadwal"}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-second/60">
            {hasFilters
              ? "Tidak ada item yang sesuai dengan filter."
              : "Tambahkan item pertama, atau jalankan seed item default di backend."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-second/10 rounded-2xl border border-second/30 bg-primary shadow-xl shadow-second/5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-4">
                <ItemChip item={item} />
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-second">
                    {item.name}
                  </p>
                  <p className="mt-2 text-xs tabular-nums text-second/60">
                    {categoryLabel(item.category)} · {formatTimeRange(item)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {!item.is_active && <Tag tone="outline">Nonaktif</Tag>}
                    {item.show_in_summary && (
                      <Tag tone="strong">Kolom rekap</Tag>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Switch
                  checked={item.is_active}
                  disabled={togglingId === item.id}
                  onChange={(next) => handleToggle(item, next)}
                  label={`${item.is_active ? "Nonaktifkan" : "Aktifkan"} ${item.code}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setFormError("");
                    setFormTarget(item);
                  }}
                  className={BTN_OUTLINE}
                >
                  <FiEdit2 size={16} aria-hidden="true" />
                  Ubah
                </button>
                <button
                  type="button"
                  onClick={() => openDelete(item)}
                  className={`${BTN_BASE} border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING}`}
                >
                  <FiTrash2 size={16} aria-hidden="true" />
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formTarget && (
        <ItemFormDialog
          key={formTarget === "new" ? "new" : formTarget.id}
          item={formTarget === "new" ? null : formTarget}
          busy={savingForm}
          error={formError}
          onClose={() => {
            if (!savingForm) setFormTarget(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Hapus item ini?"
          confirmLabel="Ya, hapus"
          busyLabel="Menghapus…"
          busy={deleteMutation.isPending}
          error={deleteError}
          onClose={() => {
            if (!deleteMutation.isPending) setToDelete(null);
          }}
          onConfirm={handleDelete}
          extra={
            deleteConflict ? (
              <button
                type="button"
                onClick={handleDeactivateInstead}
                disabled={updateMutation.isPending}
                className={`${BTN_PRIMARY} w-full`}
              >
                {updateMutation.isPending ? <Spinner /> : "Nonaktifkan saja"}
              </button>
            ) : null
          }
        >
          <p>
            <span className="font-semibold text-second">{toDelete.code}</span> (
            {toDelete.name}) akan dihapus. Item yang sudah dipakai di jadwal
            tidak bisa dihapus, tetapi bisa dinonaktifkan.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
