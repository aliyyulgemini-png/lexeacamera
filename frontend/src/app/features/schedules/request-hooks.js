import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAdminRequest,
  createRequestForm,
  deleteAdminRequest,
  deleteRequestForm,
  getAdminRequestForm,
  getAdminRequestForms,
  getAdminSchedule,
  getAdminSchedules,
  getFormRequests,
  getRequestForm,
  getRequestForms,
  reviewScheduleRequests,
  saveAdminFormEntries,
  updateAdminRequest,
  updateRequestForm,
} from "./request-api.js";

const OWNER_KEYS = [
  "schedule request forms",
  "schedule request form",
  "schedule form requests",
];
const ADMIN_FORM_KEYS = [
  "admin schedule request forms",
  "admin schedule request form",
];

// Jangan mengulang permintaan yang gagal karena akses atau data (4xx).
const retryServerErrorsOnly = (count, error) => {
  const status = error?.response?.status;
  if (status && status < 500) return false;
  return count < 2;
};

function invalidateOwnerForms(queryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => OWNER_KEYS.includes(query.queryKey[0]),
  });
}

function invalidateAdminForms(queryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => ADMIN_FORM_KEYS.includes(query.queryKey[0]),
  });
}

/* --------------------------------- Owner ---------------------------------- */

export function useGetRequestForms(params = {}) {
  return useQuery({
    queryKey: ["schedule request forms", params],
    queryFn: () => getRequestForms(params),
    placeholderData: (previous) => previous,
  });
}

export function useGetRequestForm(id) {
  return useQuery({
    queryKey: ["schedule request form", id],
    queryFn: () => getRequestForm(id),
    enabled: Boolean(id),
    retry: retryServerErrorsOnly,
  });
}

export function useGetFormRequests(id, params = {}) {
  return useQuery({
    queryKey: ["schedule form requests", id, params],
    queryFn: () => getFormRequests(id, params),
    enabled: Boolean(id),
    placeholderData: (previous) => previous,
    retry: retryServerErrorsOnly,
  });
}

export function useCreateRequestForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => createRequestForm(data),
    onSuccess: () => invalidateOwnerForms(queryClient),
  });
}

export function useUpdateRequestForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateRequestForm(id, data),
    onSuccess: () => invalidateOwnerForms(queryClient),
  });
}

export function useDeleteRequestForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => deleteRequestForm(id),
    onSuccess: () => invalidateOwnerForms(queryClient),
  });
}

// Menyetujui request mengisi sel jadwal, jadi detail jadwal ikut dimuat ulang.
export function useReviewScheduleRequests() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => reviewScheduleRequests(data),
    onSuccess: () =>
      Promise.all([
        invalidateOwnerForms(queryClient),
        queryClient.invalidateQueries({
          predicate: (query) =>
            ["schedule", "schedules"].includes(query.queryKey[0]),
        }),
      ]),
  });
}

/* --------------------------------- Admin ---------------------------------- */

export function useGetAdminSchedules(params = {}) {
  return useQuery({
    queryKey: ["admin schedules", params],
    queryFn: () => getAdminSchedules(params),
    placeholderData: (previous) => previous,
    retry: retryServerErrorsOnly,
  });
}

export function useGetAdminSchedule(id) {
  return useQuery({
    queryKey: ["admin schedule", id],
    queryFn: () => getAdminSchedule(id),
    enabled: Boolean(id),
    retry: retryServerErrorsOnly,
  });
}

export function useGetAdminRequestForms() {
  return useQuery({
    queryKey: ["admin schedule request forms"],
    queryFn: getAdminRequestForms,
    retry: retryServerErrorsOnly,
  });
}

export function useGetAdminRequestForm(id) {
  return useQuery({
    queryKey: ["admin schedule request form", id],
    queryFn: () => getAdminRequestForm(id),
    enabled: Boolean(id),
    retry: retryServerErrorsOnly,
  });
}

function useAdminRequestMutation(fn) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidateAdminForms(queryClient),
  });
}

// Klik sel di tabel: isi / ganti / hapus request (batch).
export function useSaveAdminFormEntries() {
  return useAdminRequestMutation(({ id, entries }) =>
    saveAdminFormEntries(id, entries),
  );
}

export function useCreateAdminRequest() {
  return useAdminRequestMutation((data) => createAdminRequest(data));
}

export function useUpdateAdminRequest() {
  return useAdminRequestMutation(({ id, data }) =>
    updateAdminRequest(id, data),
  );
}

export function useDeleteAdminRequest() {
  return useAdminRequestMutation((id) => deleteAdminRequest(id));
}
