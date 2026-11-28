"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiArrowLeft,
  FiCheck,
  FiClock,
  FiEdit2,
  FiInbox,
  FiLock,
  FiRefreshCw,
  FiTrash2,
  FiUnlock,
  FiUsers,
  FiX,
} from "react-icons/fi";

import {
  useDeleteRequestForm,
  useGetFormRequests,
  useGetRequestForm,
  useReviewScheduleRequests,
  useUpdateRequestForm,
} from "../../../../features/schedules/request-hooks.js";
import RequestFormDialog from "../../../../../components/owner/schedule-request-form-dialog.jsx";
import RequestGrid, {
  RequestLegend,
  StatusMark,
  requestCellProps,
} from "../../../../../components/owner/schedule-request-grid.jsx";
import {
  ErrorPanel,
  FormStateTag,
  REQUEST_FORMS_PATH,
  RequestStatusTag,
  formState,
  formatDateTime,
  formatDay,
} from "../../../../../components/owner/schedule-request-shared.jsx";
import {
  BTN_BASE,
  BTN_OUTLINE,
  BTN_PRIMARY,
  Card,
  ConfirmDialog,
  DialogHeader,
  FOCUS_RING,
  FormError,
  ItemChip,
  Modal,
  SCHEDULES_PATH,
  Spinner,
  StatCard,
  Tag,
  describeError,
  formatMonth,
  inputClass,
  labelClass,
} from "../../../../../components/owner/schedule-shared.jsx";
import { SpecialDateLegend } from "../../../../../components/owner/schedule-special-dates.jsx";
import notify from "../../../../../lib/notify.js";

const MAX_REVIEW = 1000;

/* ------------------------------ Review dialog ----------------------------- */

function ReviewDialog({
  status,
  count,
  hasApproved,
  busy,
  error,
  onClose,
  onSubmit,
}) {
  const [note, setNote] = useState("");
  const approving = status === "APPROVED";

  return (
    <Modal titleId="review-title" onClose={onClose} busy={busy}>
      <DialogHeader
        icon={approving ? FiCheck : FiX}
        tone={approving ? "grad" : "danger"}
        onClose={onClose}
        busy={busy}
      />

      <h2 id="review-title" className="mt-4 text-lg font-bold text-second">
        {approving ? "Setujui request?" : "Tolak request?"}
      </h2>

      <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-second/60">
        <p>
          <span className="font-semibold tabular-nums text-second">
            {count}
          </span>{" "}
          request akan {approving ? "disetujui" : "ditolak"}.
        </p>
        {approving ? (
          <p>
            Request yang disetujui otomatis masuk ke sel jadwal. Kalau jadwal
            bulan ini belum dibuat, sel terisi saat jadwal dibuat.
          </p>
        ) : (
          hasApproved && (
            <p className="text-second4">
              Sebagian request sudah disetujui. Menolaknya tidak mengosongkan
              sel jadwal yang sudah terisi. Ubah sel itu manual di editor
              jadwal.
            </p>
          )
        )}
      </div>

      <div className="mt-4">
        <label htmlFor="review-note" className={labelClass}>
          Catatan untuk karyawan
          <span className="ml-2 text-xs font-normal text-second/50">
            Opsional
          </span>
        </label>
        <textarea
          id="review-note"
          rows={3}
          maxLength={500}
          value={note}
          disabled={busy}
          onChange={(event) => setNote(event.target.value)}
          className={inputClass(false)}
        />
        <p className="mt-2 text-xs text-second/60">
          Berlaku untuk semua request yang dipilih.
        </p>
      </div>

      {error && (
        <div className="mt-4">
          <FormError>{error}</FormError>
        </div>
      )}

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
          type="button"
          onClick={() => onSubmit(note)}
          disabled={busy}
          aria-busy={busy}
          className={`${BTN_BASE} w-full sm:w-auto ${
            approving
              ? "bg-grad text-primary shadow-lg shadow-second4/25"
              : "bg-second2 text-primary shadow-lg shadow-second2/25"
          } hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        >
          {busy ? (
            <>
              <Spinner />
              Memproses…
            </>
          ) : approving ? (
            "Setujui"
          ) : (
            "Tolak"
          )}
        </button>
      </div>
    </Modal>
  );
}

/* ----------------------------- Review buttons ----------------------------- */

function ReviewButtons({ disabled, onReview }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onReview("APPROVED")}
        className={BTN_PRIMARY}
      >
        <FiCheck size={16} aria-hidden="true" />
        Setujui
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onReview("REJECTED")}
        className={`${BTN_BASE} border border-second2/30 text-second2 hover:bg-second2 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
      >
        <FiX size={16} aria-hidden="true" />
        Tolak
      </button>
    </div>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function RequestFormDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");

  const formQuery = useGetRequestForm(id);
  const requestsQuery = useGetFormRequests(id, {
    status: statusFilter,
    employee_id: employeeFilter,
  });

  const updateMutation = useUpdateRequestForm();
  const deleteMutation = useDeleteRequestForm();
  const reviewMutation = useReviewScheduleRequests();

  const [showEdit, setShowEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [reviewStatus, setReviewStatus] = useState(null);
  const [reviewError, setReviewError] = useState("");

  const form = formQuery.data;
  const rows = useMemo(() => form?.rows ?? [], [form]);
  const dates = form?.dates ?? [];
  const requests = useMemo(
    () => requestsQuery.data ?? [],
    [requestsQuery.data],
  );

  // Semua request yang dikenal (dari tabel dan dari daftar), untuk seleksi.
  const infoById = useMemo(() => {
    const map = {};

    for (const row of rows) {
      for (const cell of Object.values(row.days ?? {})) {
        if (cell.request_id) map[cell.request_id] = { status: cell.status };
      }
    }
    for (const request of requests) {
      map[request.id] = { status: request.status };
    }

    return map;
  }, [rows, requests]);

  // Buang pilihan yang sudah tidak ada.
  useEffect(() => {
    if (!form) return;

    setSelected((current) => {
      const next = new Set([...current].filter((value) => value in infoById));
      return next.size === current.size ? current : next;
    });
  }, [form, infoById]);

  const employeeOptions = useMemo(
    () =>
      rows
        .map((row) => ({ id: row.employee.id, name: row.employee.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "id")),
    [rows],
  );

  const pendingIds = Object.entries(infoById)
    .filter(([, info]) => info.status === "PENDING")
    .map(([requestId]) => requestId);

  const hasApprovedSelected = [...selected].some(
    (requestId) => infoById[requestId]?.status === "APPROVED",
  );

  function toggleRequest(requestId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(requestId)) next.delete(requestId);
      else next.add(requestId);
      return next;
    });
  }

  function openReview(status) {
    setReviewError("");
    setReviewStatus(status);
  }

  async function handleReview(note) {
    setReviewError("");

    try {
      const ids = [...selected];
      const result = { updated: 0, applied_to_schedule: 0 };

      for (let index = 0; index < ids.length; index += MAX_REVIEW) {
        const part = await reviewMutation.mutateAsync({
          request_ids: ids.slice(index, index + MAX_REVIEW),
          status: reviewStatus,
          ...(note.trim() && { owner_note: note.trim() }),
        });
        result.updated += part?.updated ?? 0;
        result.applied_to_schedule += part?.applied_to_schedule ?? 0;
      }

      const approved = reviewStatus === "APPROVED";
      notify.success(
        `${result.updated} request ${approved ? "disetujui" : "ditolak"}.${
          approved ? ` ${result.applied_to_schedule} sel terisi ke jadwal.` : ""
        }`,
      );

      setSelected(new Set());
      setReviewStatus(null);
    } catch (error) {
      setReviewError(describeError(error));
      if (error?.response?.status === 404) {
        formQuery.refetch();
        requestsQuery.refetch();
      }
    }
  }

  async function handleToggleOpen() {
    const next = form.status === "OPEN" ? "CLOSED" : "OPEN";

    try {
      await updateMutation.mutateAsync({ id, data: { status: next } });
      notify.success(
        next === "CLOSED" ? "Form ditutup." : "Form dibuka kembali.",
      );
    } catch (error) {
      notify.error(describeError(error));
    }
  }

  async function handleEdit(data) {
    setEditError("");

    try {
      await updateMutation.mutateAsync({ id, data });
      notify.success("Form diperbarui.");
      setShowEdit(false);
    } catch (error) {
      setEditError(describeError(error));
    }
  }

  async function handleDelete() {
    setDeleteError("");

    try {
      await deleteMutation.mutateAsync(id);
      notify.success("Form dihapus.");
      router.replace(REQUEST_FORMS_PATH);
    } catch (error) {
      setDeleteError(describeError(error));
    }
  }

  const backLink = (
    <Link
      href={REQUEST_FORMS_PATH}
      className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
    >
      <FiArrowLeft size={16} aria-hidden="true" />
      Kembali ke daftar form
    </Link>
  );

  if (formQuery.isPending) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <div className="h-8 w-48 animate-pulse rounded-full bg-second/10" />
        <div className="h-24 animate-pulse rounded-2xl bg-second/10" />
        <div className="h-96 animate-pulse rounded-2xl bg-second/10" />
      </div>
    );
  }

  if (formQuery.isError || !form) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
        <header>{backLink}</header>
        <ErrorPanel
          error={formQuery.error}
          onRetry={() => formQuery.refetch()}
          isFetching={formQuery.isFetching}
        />
      </div>
    );
  }

  const counts = form.request_count ?? {};
  const state = formState(form);
  const allowedItems = form.allowed_items ?? [];
  const busyRefresh = formQuery.isFetching || requestsQuery.isFetching;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      {/* Header */}
      <header className="flex flex-col gap-4">
        {backLink}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-second/60">{formatMonth(form.month)}</p>
            <h1 className="mt-2 break-words text-xl font-bold tracking-tight text-second sm:text-2xl">
              {form.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <FormStateTag form={form} />
              <Tag tone="soft">{counts.total ?? 0} request</Tag>
              <Tag tone="soft">{rows.length} karyawan</Tag>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto">
            <button
              type="button"
              onClick={() => {
                formQuery.refetch();
                requestsQuery.refetch();
              }}
              disabled={busyRefresh}
              className={BTN_OUTLINE}
            >
              <FiRefreshCw
                size={16}
                className={
                  busyRefresh ? "animate-spin motion-reduce:animate-none" : ""
                }
                aria-hidden="true"
              />
              Perbarui
            </button>
            <Link href={SCHEDULES_PATH} className={BTN_OUTLINE}>
              Ke jadwal
            </Link>
            <button
              type="button"
              onClick={() => {
                setEditError("");
                setShowEdit(true);
              }}
              className={BTN_OUTLINE}
            >
              <FiEdit2 size={16} aria-hidden="true" />
              Ubah
            </button>
            <button
              type="button"
              onClick={handleToggleOpen}
              disabled={updateMutation.isPending}
              className={form.status === "OPEN" ? BTN_OUTLINE : BTN_PRIMARY}
            >
              {updateMutation.isPending ? (
                <Spinner />
              ) : form.status === "OPEN" ? (
                <FiLock size={16} aria-hidden="true" />
              ) : (
                <FiUnlock size={16} aria-hidden="true" />
              )}
              {form.status === "OPEN" ? "Tutup form" : "Buka lagi"}
            </button>
          </div>
        </div>

        {!state.open && form.status === "OPEN" && (
          <p className="rounded-xl border border-second4/30 bg-second4/5 px-4 py-2 text-sm text-second4">
            Batas waktu sudah lewat, jadi admin tidak bisa mengisi lagi.
            Perpanjang lewat tombol Ubah kalau perlu.
          </p>
        )}
      </header>

      {/* Ringkasan */}
      <section
        aria-label="Ringkasan request"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          icon={FiClock}
          label="Menunggu"
          value={counts.pending ?? 0}
          hint="Belum diproses"
        />
        <StatCard
          icon={FiCheck}
          label="Disetujui"
          value={counts.approved ?? 0}
          hint="Masuk ke jadwal"
        />
        <StatCard icon={FiX} label="Ditolak" value={counts.rejected ?? 0} />
        <StatCard
          icon={FiUsers}
          label="Kuota per karyawan"
          value={
            form.max_days_per_employee
              ? `${form.max_days_per_employee} hari`
              : "Tanpa batas"
          }
          hint={
            form.closes_at
              ? `Sampai ${formatDateTime(form.closes_at)}`
              : "Terbuka sampai ditutup"
          }
        />
      </section>

      {(form.description || allowedItems.length > 0) && (
        <Card title="Aturan form">
          {form.description && (
            <p className="whitespace-pre-line break-words text-sm text-second/70">
              {form.description}
            </p>
          )}

          <div className="min-w-0">
            <p className="text-xs font-semibold text-second/60">
              Item yang boleh dipilih
            </p>
            {allowedItems.length === 0 ? (
              <p className="mt-2 text-sm text-second/60">Semua item aktif.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {allowedItems.map((item) => (
                  <span
                    key={item.id}
                    className="flex items-center gap-2 rounded-xl border border-second/30 p-2 text-xs text-second"
                    title={item.name}
                  >
                    <ItemChip item={item} />
                    {item.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tabel request */}
      <Card
        title="Tabel request"
        description="Klik sel yang berisi request untuk memilihnya, lalu setujui atau tolak. Kolom kanan menunjukkan kuota terpakai per karyawan."
      >
        <div className="flex flex-col gap-2 rounded-xl bg-second/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className="text-sm font-semibold tabular-nums text-second"
              aria-live="polite"
            >
              {selected.size} dipilih
            </p>
            <button
              type="button"
              onClick={() => setSelected(new Set(pendingIds))}
              disabled={pendingIds.length === 0}
              className={`${BTN_OUTLINE} !px-2 !py-1 text-xs`}
            >
              Pilih yang menunggu ({pendingIds.length})
            </button>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className={`${BTN_OUTLINE} !px-2 !py-1 text-xs`}
              >
                Batal pilih
              </button>
            )}
          </div>

          <ReviewButtons disabled={selected.size === 0} onReview={openReview} />
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-second/60">
            Belum ada karyawan di form ini. Tambahkan lewat tombol Ubah.
          </p>
        ) : (
          <RequestGrid
            dates={dates}
            rows={rows}
            dimmed={formQuery.isFetching}
            quotaCell={(row) =>
              row.quota
                ? row.quota.max == null
                  ? `${row.quota.used}`
                  : `${row.quota.used}/${row.quota.max}`
                : "—"
            }
            renderCell={(row, day) => {
              const face = row.days?.[day.date];
              if (!face) return <div className="h-8 w-8" />;

              const props = requestCellProps(face);
              const isSelected =
                Boolean(face.request_id) && selected.has(face.request_id);

              return (
                <button
                  type="button"
                  disabled={!face.request_id}
                  onClick={() => toggleRequest(face.request_id)}
                  aria-pressed={isSelected}
                  aria-label={`${row.employee.name}, ${day.date}: ${face.code}, ${props.label}`}
                  title={`${row.employee.name}, ${day.date}: ${face.code} (${props.label})${
                    face.note ? `\nAlasan: ${face.note}` : ""
                  }`}
                  className={`flex h-8 w-8 items-center justify-center text-xs font-semibold transition-opacity hover:opacity-80 ${FOCUS_RING} ${props.className} ${
                    isSelected
                      ? "outline outline-2 -outline-offset-2 outline-second"
                      : ""
                  }`}
                  style={props.style}
                >
                  {face.code}
                </button>
              );
            }}
          />
        )}

        <RequestLegend />
        <SpecialDateLegend specialDates={form.special_dates} />
      </Card>

      {/* Daftar request */}
      <Card
        title="Daftar request"
        description="Rincian lengkap dengan alasan dan catatan. Pilihan di sini dan di tabel saling terhubung."
        aside={<Tag tone="soft">{requests.length} ditampilkan</Tag>}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="rq-status" className={labelClass}>
              Status
            </label>
            <select
              id="rq-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={inputClass(false)}
            >
              <option value="">Semua</option>
              <option value="PENDING">Menunggu</option>
              <option value="APPROVED">Disetujui</option>
              <option value="REJECTED">Ditolak</option>
            </select>
          </div>

          <div className="min-w-0">
            <label htmlFor="rq-employee" className={labelClass}>
              Karyawan
            </label>
            <select
              id="rq-employee"
              value={employeeFilter}
              onChange={(event) => setEmployeeFilter(event.target.value)}
              className={inputClass(false)}
            >
              <option value="">Semua karyawan</option>
              {employeeOptions.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="sticky top-0 z-10 flex flex-col gap-2 rounded-xl border border-second/20 bg-primary p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold tabular-nums text-second">
              {selected.size} dipilih
            </p>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className={`${BTN_OUTLINE} !px-2 !py-1 text-xs`}
              >
                Batal pilih
              </button>
            )}
          </div>
          <ReviewButtons disabled={selected.size === 0} onReview={openReview} />
        </div>

        {requestsQuery.isPending ? (
          <div className="h-40 animate-pulse rounded-xl bg-second/10" />
        ) : requestsQuery.isError && !requestsQuery.data ? (
          <div className="flex flex-wrap items-center gap-2">
            <FormError>{describeError(requestsQuery.error)}</FormError>
            <button
              type="button"
              onClick={() => requestsQuery.refetch()}
              className={BTN_OUTLINE}
            >
              Coba lagi
            </button>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-second/20 px-4 py-16 text-center">
            <FiInbox size={24} className="text-second/40" aria-hidden="true" />
            <p className="mt-4 text-sm font-semibold text-second">
              {statusFilter || employeeFilter
                ? "Request tidak ditemukan"
                : "Belum ada request"}
            </p>
            <p className="mt-2 text-sm text-second/60">
              {statusFilter || employeeFilter
                ? "Tidak ada request yang sesuai dengan filter."
                : "Request akan muncul setelah admin mengisi tabel."}
            </p>
          </div>
        ) : (
          <div
            className={`transition-opacity ${
              requestsQuery.isFetching ? "opacity-60" : ""
            }`}
          >
            {/* Tabel desktop */}
            <div className="hidden overflow-x-auto rounded-xl border border-second/30 md:block">
              <table className="min-w-full text-left">
                <thead className="bg-grad text-sm text-primary">
                  <tr>
                    <th scope="col" className="w-10 px-4 py-3">
                      <span className="sr-only">Pilih</span>
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Tanggal
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Karyawan
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Item
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Alasan
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-second/10">
                  {requests.map((request, index) => (
                    <tr
                      key={request.id}
                      className={`align-top transition-colors hover:bg-second/20 ${
                        index % 2 === 0 ? "" : "bg-second3/20"
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selected.has(request.id)}
                          onChange={() => toggleRequest(request.id)}
                          aria-label={`Pilih request ${request.employee?.name} ${request.date}`}
                          className={`size-4 cursor-pointer accent-second4 ${FOCUS_RING}`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold tabular-nums text-second">
                        {formatDay(request.date)}
                      </td>
                      <td className="px-4 py-4 text-sm text-second">
                        {request.employee?.name ?? "—"}
                      </td>
                      <td className="px-4 py-4">
                        {request.item && (
                          <span title={request.item.name}>
                            <ItemChip item={request.item} />
                          </span>
                        )}
                      </td>
                      <td className="max-w-64 px-4 py-4 text-sm text-second/70">
                        <p className="break-words">{request.note ?? "—"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-2">
                          <StatusMark status={request.status} />
                          <RequestStatusTag status={request.status} />
                        </span>
                        {request.owner_note && (
                          <p className="mt-2 max-w-48 break-words text-xs text-second/60">
                            {request.owner_note}
                          </p>
                        )}
                        {request.reviewed_at && (
                          <p className="mt-2 text-xs tabular-nums text-second/60">
                            {formatDateTime(request.reviewed_at)}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Kartu mobile */}
            <ul className="flex flex-col gap-4 md:hidden">
              {requests.map((request) => (
                <li
                  key={request.id}
                  className="flex min-w-0 flex-col gap-2 rounded-xl border border-second/30 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <label className="flex min-w-0 cursor-pointer items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selected.has(request.id)}
                        onChange={() => toggleRequest(request.id)}
                        className={`mt-0.5 size-4 shrink-0 cursor-pointer accent-second4 ${FOCUS_RING}`}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-second">
                          {request.employee?.name ?? "—"}
                        </span>
                        <span className="mt-2 block text-xs tabular-nums text-second/60">
                          {formatDay(request.date)}
                        </span>
                      </span>
                    </label>
                    {request.item && <ItemChip item={request.item} />}
                  </div>
                  {request.note && (
                    <p className="break-words text-xs text-second/70">
                      {request.note}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2">
                      <StatusMark status={request.status} />
                      <RequestStatusTag status={request.status} />
                    </span>
                  </div>
                  {request.owner_note && (
                    <p className="break-words text-xs text-second/60">
                      Catatan owner: {request.owner_note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Hapus */}
      <Card
        title="Hapus form"
        description="Menghapus form beserta semua request di dalamnya. Sel jadwal yang sudah terisi dari request tidak berubah."
      >
        <button
          type="button"
          onClick={() => {
            setDeleteError("");
            setShowDelete(true);
          }}
          className={`${BTN_BASE} w-fit border border-second2/30 text-second2 hover:bg-second2 hover:text-primary ${FOCUS_RING}`}
        >
          <FiTrash2 size={16} aria-hidden="true" />
          Hapus form
        </button>
      </Card>

      {showEdit && (
        <RequestFormDialog
          form={form}
          busy={updateMutation.isPending}
          error={editError}
          onClose={() => {
            if (!updateMutation.isPending) setShowEdit(false);
          }}
          onSubmit={handleEdit}
        />
      )}

      {reviewStatus && (
        <ReviewDialog
          status={reviewStatus}
          count={selected.size}
          hasApproved={hasApprovedSelected}
          busy={reviewMutation.isPending}
          error={reviewError}
          onClose={() => {
            if (!reviewMutation.isPending) setReviewStatus(null);
          }}
          onSubmit={handleReview}
        />
      )}

      {showDelete && (
        <ConfirmDialog
          title="Hapus form ini?"
          confirmLabel="Hapus permanen"
          busyLabel="Menghapus…"
          busy={deleteMutation.isPending}
          error={deleteError}
          onClose={() => {
            if (!deleteMutation.isPending) setShowDelete(false);
          }}
          onConfirm={handleDelete}
        >
          <p>
            Form <span className="font-semibold text-second">{form.title}</span>{" "}
            dihapus permanen beserta {counts.total ?? 0} request di dalamnya.
            Sel jadwal yang sudah terisi dari request tidak berubah.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
