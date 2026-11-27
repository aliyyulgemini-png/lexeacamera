import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addScheduleEmployees,
  createSchedule,
  createScheduleItem,
  deleteSchedule,
  deleteScheduleItem,
  getAllEmployees,
  getSchedule,
  getScheduleItems,
  getSchedules,
  removeScheduleEmployee,
  reorderScheduleEmployees,
  saveScheduleEntries,
  updateSchedule,
  updateScheduleItem,
} from "./api.js";

const ITEM_KEY = "schedule items";
const LIST_KEY = "schedules";
const DETAIL_KEY = "schedule";

/* ---------------------------------- Item --------------------------------- */

// Item dipakai di semua jadwal, jadi perubahannya memuat ulang ketiganya.
function invalidateAll(queryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) =>
      [ITEM_KEY, LIST_KEY, DETAIL_KEY].includes(query.queryKey[0]),
  });
}

export function useGetScheduleItems(params = {}) {
  return useQuery({
    queryKey: [ITEM_KEY, params],
    queryFn: () => getScheduleItems(params),
    placeholderData: (previous) => previous,
  });
}

export function useCreateScheduleItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => createScheduleItem(data),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateScheduleItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateScheduleItem(id, data),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteScheduleItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => deleteScheduleItem(id),
    onSuccess: () => invalidateAll(queryClient),
  });
}

/* --------------------------------- Jadwal -------------------------------- */

export function useGetSchedules(params = {}) {
  return useQuery({
    queryKey: [LIST_KEY, params],
    queryFn: () => getSchedules(params),
    placeholderData: (previous) => previous,
  });
}

export function useGetSchedule(id) {
  return useQuery({
    queryKey: [DETAIL_KEY, id],
    queryFn: () => getSchedule(id),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => createSchedule(data),
    onSuccess: (schedule) => {
      // Respons POST sudah berisi detail lengkap.
      if (schedule?.id) {
        queryClient.setQueryData([DETAIL_KEY, schedule.id], schedule);
      }
      return queryClient.invalidateQueries({ queryKey: [LIST_KEY] });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateSchedule(id, data),
    onSuccess: (updated, { id }) => {
      queryClient.setQueryData([DETAIL_KEY, id], (old) =>
        old ? { ...old, ...updated } : old,
      );
      return queryClient.invalidateQueries({ queryKey: [LIST_KEY] });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => deleteSchedule(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: [DETAIL_KEY, id] });
      return queryClient.invalidateQueries({ queryKey: [LIST_KEY] });
    },
  });
}

/* Sengaja tidak memuat ulang detail: editor memegang state sel sendiri. */
export function useSaveScheduleEntries() {
  return useMutation({
    mutationFn: ({ id, entries }) => saveScheduleEntries(id, entries),
  });
}

function useEmployeeMutation(fn) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: (_result, variables) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [DETAIL_KEY, variables.id] }),
        queryClient.invalidateQueries({ queryKey: [LIST_KEY] }),
      ]),
  });
}

export function useAddScheduleEmployees() {
  return useEmployeeMutation(({ id, employeeIds }) =>
    addScheduleEmployees(id, employeeIds),
  );
}

export function useRemoveScheduleEmployee() {
  return useEmployeeMutation(({ id, employeeId }) =>
    removeScheduleEmployee(id, employeeId),
  );
}

export function useReorderScheduleEmployees() {
  return useEmployeeMutation(({ id, employeeIds }) =>
    reorderScheduleEmployees(id, employeeIds),
  );
}

/* ------------------------------- Karyawan -------------------------------- */

export function useGetScheduleEmployeeOptions(enabled = true) {
  return useQuery({
    queryKey: ["schedule employee options"],
    queryFn: getAllEmployees,
    enabled,
    staleTime: 60 * 1000,
  });
}
