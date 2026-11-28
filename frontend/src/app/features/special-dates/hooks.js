"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../lib/api/client.js";

// SESUAIKAN: pakai baris import axios yang sama dengan features/schedules.

const KEY = ["special-dates"];
const URL = "/owner/special-dates";

export function useGetSpecialDates(year) {
  return useQuery({
    queryKey: [...KEY, year],
    queryFn: async () => {
      const response = await api.get(URL, {
        params: year ? { year } : undefined,
      });
      return response.data.data;
    },
  });
}

function useSpecialDateMutation(mutationFn) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export const useCreateSpecialDate = () =>
  useSpecialDateMutation(async (data) => {
    const response = await api.post(URL, data);
    return response.data.data;
  });

export const useUpdateSpecialDate = () =>
  useSpecialDateMutation(async ({ id, data }) => {
    const response = await api.put(`${URL}/${id}`, data);
    return response.data.data;
  });

export const useDeleteSpecialDate = () =>
  useSpecialDateMutation(async (id) => {
    const response = await api.delete(`${URL}/${id}`);
    return response.data.data;
  });
