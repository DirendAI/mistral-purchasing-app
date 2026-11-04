import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProduct,
  deleteProduct,
  deleteProductSchedule,
  getProductSchedule,
  getSettings,
  listProducts,
  putProductSchedule,
  putSettings,
  triggerResearch,
} from "./generated";
import type {
  BodyCreateProduct,
  ProductOut,
  ScheduleIn,
  ScheduleOut,
  SettingsIn,
} from "./generated";
import { dataOr404, unwrap } from "./unwrap";

export const productsKey = ["products"] as const;
export const settingsKey = ["settings"] as const;
const scheduleKey = (productId: string) => ["schedule", productId] as const;

export const useProducts = () =>
  useQuery({
    queryKey: productsKey,
    queryFn: () => unwrap(listProducts({ throwOnError: true })),
    // A run started from the UI is asynchronous: keep polling while any product's latest run is still running.
    refetchInterval: (query) =>
      query.state.data?.some((product) => product.latest_run?.status === "running") ? 5_000 : false,
  });

export const useSettings = () =>
  useQuery({ queryKey: settingsKey, queryFn: () => unwrap(getSettings({ throwOnError: true })) });

export const useSaveSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: SettingsIn) => unwrap(putSettings({ body, throwOnError: true })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKey }),
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: BodyCreateProduct) => unwrap(createProduct({ body, throwOnError: true })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productsKey }),
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) =>
      unwrap(deleteProduct({ path: { product_id: productId }, throwOnError: true })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productsKey }),
  });
};

export const useTriggerResearch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) =>
      unwrap(triggerResearch({ path: { product_id: productId }, throwOnError: true })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productsKey }),
  });
};

export const useProductSchedule = (productId: string) =>
  useQuery({
    queryKey: scheduleKey(productId),
    queryFn: async (): Promise<ScheduleOut | null> => {
      const result = await getProductSchedule({ path: { product_id: productId } });

      // No schedule yet is a normal state, not an error.
      if (result.response?.status === 404) {
        return null;
      }

      return dataOr404(result, () => new Error("Could not load the schedule."));
    },
  });

export const usePutSchedule = (productId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ScheduleIn) =>
      unwrap(putProductSchedule({ path: { product_id: productId }, body, throwOnError: true })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKey(productId) });
      queryClient.invalidateQueries({ queryKey: productsKey });
    },
  });
};

export const useDeleteSchedule = (productId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      unwrap(deleteProductSchedule({ path: { product_id: productId }, throwOnError: true })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKey(productId) });
      queryClient.invalidateQueries({ queryKey: productsKey });
    },
  });
};

export type { ProductOut };
