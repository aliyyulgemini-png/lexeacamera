import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAttendanceDevice,
  createAttendanceNetwork,
  deleteAttendanceDevice,
  deleteAttendanceNetwork,
  getAttendanceDevices,
  getAttendanceNetworks,
  getAttendanceSettings,
  getAttendances,
  getMyIp,
  updateAttendance,
  updateAttendanceCheckIn,
  updateAttendanceDevice,
  updateAttendanceNetwork,
  updateAttendanceSettings,
} from "./api.js";

export function useGetAttendanceNetworks() {
  return useQuery({
    queryKey: ["attendance-networks"],
    queryFn: getAttendanceNetworks,
  });
}

export function useGetAttendanceSettings() {
  return useQuery({
    queryKey: ["attendance-settings"],
    queryFn: getAttendanceSettings,
  });
}

/* Dipanggil manual lewat refetch() (tombol "Ambil IP otomatis"). */
export function useGetMyIp() {
  return useQuery({
    queryKey: ["my-ip"],
    queryFn: getMyIp,
    enabled: false,
    retry: false,
    gcTime: 0,
  });
}

/* Jumlah jaringan aktif ada di pengaturan, jadi keduanya disegarkan bersama. */
function invalidateAttendance(queryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["attendance-networks"] }),
    queryClient.invalidateQueries({ queryKey: ["attendance-settings"] }),
  ]);
}

export function useCreateAttendanceNetwork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["attendance-networks", "create"],
    mutationFn: createAttendanceNetwork,
    onSuccess: () => invalidateAttendance(queryClient),
  });
}

export function useUpdateAttendanceNetwork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["attendance-networks", "update"],
    mutationFn: ({ id, data }) => updateAttendanceNetwork(id, data),
    onSuccess: () => invalidateAttendance(queryClient),
  });
}

export function useDeleteAttendanceNetwork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["attendance-networks", "delete"],
    mutationFn: (id) => deleteAttendanceNetwork(id),
    onSuccess: () => invalidateAttendance(queryClient),
  });
}

export function useUpdateAttendanceSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["attendance-settings", "update"],
    mutationFn: updateAttendanceSettings,
    onSuccess: () => invalidateAttendance(queryClient),
  });
}

/* ---------- Rekap absen ---------- */

export function useGetAttendances(filters) {
  return useQuery({
    queryKey: ["attendances", filters],
    queryFn: () => getAttendances(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function useUpdateAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["attendances", "update"],
    mutationFn: ({ id, data }) => updateAttendance(id, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["attendances"] }),
  });
}
const DEVICES_KEY = ["attendance devices"];

// Settings memuat active_devices, jadi ikut dimuat ulang setiap perangkat berubah.
function invalidateDeviceRelated(queryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = String(query.queryKey[0] ?? "").toLowerCase();
      return (
        key.includes("device") ||
        key.includes("setting") ||
        key.includes("network")
      );
    },
  });
}

export function useGetAttendanceDevices() {
  return useQuery({
    queryKey: DEVICES_KEY,
    queryFn: getAttendanceDevices,
  });
}

export function useCreateAttendanceDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => createAttendanceDevice(data),
    onSuccess: () => invalidateDeviceRelated(queryClient),
  });
}

export function useUpdateAttendanceDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateAttendanceDevice(id, data),
    onSuccess: () => invalidateDeviceRelated(queryClient),
  });
}

export function useDeleteAttendanceDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => deleteAttendanceDevice(id),
    onSuccess: () => invalidateDeviceRelated(queryClient),
  });
}
export function useUpdateAttendanceCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateAttendanceCheckIn(id, data), // PUT /owner/attendances/:id/check-in
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["attendances"] }),
  });
}
