import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProduct,
  deleteProduct,
  deleteProductSchedule,
  getProduct,
  getProductSchedule,
  getSettings,
  listProducts,
  listResearchRuns,
  putProductSchedule,
  putSettings,
  triggerResearch,
} from "./generated";
import type {
  BodyCreateProduct,
  ProductOut,
  ResearchRunOut,
  ScheduleIn,
  ScheduleOut,
  SettingsIn,
} from "./generated";
import { dataOr404, unwrap } from "./unwrap";

export const runsKey = (productId: string) => ["research-runs", productId] as const;

/** A placeholder run shown immediately when a research is triggered, until the worker creates the real row. */
const pendingRun = (productId: string): ResearchRunOut => ({
  id: "pending",
  product_id: productId,
  trigger: "manual",
  status: "running",
  started_at: new Date().toISOString(),
  findings: [],
});

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

export const useProduct = (productId: string) =>
  useQuery({
    queryKey: ["product", productId],
    queryFn: () => unwrap(getProduct({ path: { product_id: productId }, throwOnError: true })),
  });

export const useResearchRuns = (productId: string) =>
  useQuery({
    queryKey: runsKey(productId),
    queryFn: () =>
      unwrap(listResearchRuns({ path: { product_id: productId }, query: { limit: 100 }, throwOnError: true })),
    // Keep polling while the latest run is still going.
    refetchInterval: (query) =>
      query.state.data?.[0]?.status === "running" ? 5_000 : false,
  });

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
    onSuccess: (_data, productId) => {
      // Show the run as "running" immediately instead of waiting for the next poll.
      queryClient.setQueryData<ProductOut[]>(productsKey, (products) =>
        products?.map((p) => (p.id === productId ? { ...p, latest_run: pendingRun(productId) } : p))
      );
      queryClient.setQueryData<ResearchRunOut[]>(runsKey(productId), (runs) => [pendingRun(productId), ...(runs ?? [])]);
      queryClient.invalidateQueries({ queryKey: productsKey });
      queryClient.invalidateQueries({ queryKey: runsKey(productId) });
    },
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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Human-readable label for a schedule: "hourly", "daily at 09:00", "weekly on Monday at 09:00", … */
export const describeSchedule = (schedule: ScheduleOut): string => {
  if (schedule.interval_seconds) {
    return schedule.interval_seconds === 3600
      ? "hourly"
      : `every ${Math.round(schedule.interval_seconds / 60)} min`;
  }
  const expression = schedule.cron_expressions?.[0];
  if (!expression) return "";
  const parts = expression.split(/\s+/);
  if (parts.length !== 5) return expression;
  const [minute, hour, dom, month, dow] = parts;
  const at = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  if (dom === "*" && month === "*" && dow === "*") return `daily at ${at}`;
  if (dom === "*" && month === "*" && /^\d$/.test(dow)) {
    return `weekly on ${DAY_NAMES[Number(dow)] ?? dow} at ${at}`;
  }
  return expression;
};

export type { ProductOut };
