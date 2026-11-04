import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  useDeleteProduct,
  useProduct,
  useResearchRuns,
  useTriggerResearch,
  type ProductOut,
} from "../../api/purchasing";
import type { ResearchRunOut } from "../../api/generated";
import { AppShell } from "../../components/AppShell";
import { PriceHistoryChart, type PricePoint } from "../../components/PriceHistoryChart";
import { ScheduleDialog } from "../../components/ScheduleDialog";

const fmtPrice = (price: number | null | undefined, currency: string | null | undefined) =>
  price == null ? "—" : `${price.toFixed(2)} ${currency ?? ""}`.trim();

const fmtTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "—");

const bestPriceOf = (run: ResearchRunOut): number | null => {
  if (run.best_price != null) return run.best_price;
  const prices = (run.findings ?? []).map((f) => f.price).filter((p): p is number => p != null);
  return prices.length > 0 ? Math.min(...prices) : null;
};

const RunCard = ({ run }: { run: ResearchRunOut }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            run.status === "completed"
              ? "bg-green-100 text-green-800"
              : run.status === "failed"
                ? "bg-red-100 text-red-800"
                : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {run.status}
        </span>
        <span className="text-xs text-gray-500">{run.trigger}</span>
        <span className="text-xs text-gray-500">
          {fmtTime(run.started_at)} → {fmtTime(run.finished_at)}
        </span>
        {run.target_met != null && (
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              run.target_met ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
            }`}
          >
            {run.target_met ? "target reached" : "above target"}
          </span>
        )}
        <span className="ml-auto font-medium">
          Best: {fmtPrice(run.best_price, run.findings?.[0]?.currency)}
          {run.best_store ? ` at ${run.best_store}` : ""}
        </span>
      </div>
      {run.error && <p className="mt-1 text-xs text-red-600">{run.error}</p>}
      {run.summary && <p className="mt-1 text-gray-700">{run.summary}</p>}
      {((run.findings?.length ?? 0) > 0 || run.details) && (
        <button className="mt-1 text-xs underline" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide" : "Show"} details
        </button>
      )}
      {expanded && (
        <div className="mt-2 flex flex-col gap-2">
          {run.findings && run.findings.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs">
              {run.findings.map((finding) => (
                <li key={finding.id} className="rounded border border-gray-200 bg-gray-50 p-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{finding.store_name}</span>
                    <span>
                      {fmtPrice(finding.price, finding.currency)}
                      {finding.in_stock === false ? " · out of stock" : ""}
                      {finding.distance_km != null ? ` · ${finding.distance_km} km` : ""}
                    </span>
                  </div>
                  {finding.title && <p className="truncate text-gray-600">{finding.title}</p>}
                  {finding.product_url && (
                    <a className="underline" href={finding.product_url} target="_blank" rel="noreferrer">
                      offer link
                    </a>
                  )}
                  {finding.notes && <p className="text-gray-500">{finding.notes}</p>}
                </li>
              ))}
            </ul>
          )}
          {run.details && (
            <details className="text-xs">
              <summary className="cursor-pointer underline">Raw researcher notes</summary>
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-100 p-2">
                {run.details}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

const ProductDetailPage = () => {
  const { productId } = Route.useParams();
  const navigate = useNavigate();
  const { data: product, isLoading, error } = useProduct(productId);
  const runsQuery = useResearchRuns(productId);
  const triggerResearch = useTriggerResearch();
  const deleteProduct = useDeleteProduct();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const runs = runsQuery.data ?? [];
  const points: PricePoint[] = [...runs]
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
    .map((run) => ({ time: run.started_at, price: bestPriceOf(run) }))
    .filter((p): p is PricePoint => p.price != null);

  return (
    <AppShell>
      <Link to="/" className="text-sm underline">
        ← All products
      </Link>

      {isLoading && <p className="mt-6 text-gray-500">Loading…</p>}
      {error && <p className="mt-6 text-red-600">{error.message}</p>}

      {product && (
        <>
          <div className="mt-4 flex flex-wrap items-start gap-4">
            {product.has_image ? (
              <img
                src={`/api/v1/products/${product.id}/image`}
                alt={product.name}
                className="h-28 w-28 rounded object-cover"
              />
            ) : product.image_url ? (
              <img src={product.image_url} alt={product.name} className="h-28 w-28 rounded object-cover" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded bg-gray-100 text-3xl">📦</div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold">{product.name}</h1>
              {product.target_price != null && (
                <p className="mt-1 text-sm text-gray-600">
                  Target price: {fmtPrice(product.target_price, product.currency)}
                </p>
              )}
              <div className="mt-1 flex flex-wrap gap-3 text-sm">
                {product.source_url && (
                  <a className="underline" href={product.source_url} target="_blank" rel="noreferrer">
                    store where seen
                  </a>
                )}
                {product.product_url && (
                  <a className="underline" href={product.product_url} target="_blank" rel="noreferrer">
                    product page
                  </a>
                )}
              </div>
              {product.ai_context && <p className="mt-2 max-w-2xl text-sm text-gray-600">{product.ai_context}</p>}
              {product.schedule && (
                <p className="mt-2 text-xs text-gray-500">
                  Schedule:{" "}
                  {product.schedule.cron_expressions?.length
                    ? product.schedule.cron_expressions.join(", ")
                    : `every ${Math.round((product.schedule.interval_seconds ?? 0) / 60)} min`}
                  {product.schedule.enabled ? "" : " (paused)"}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => triggerResearch.mutate(product.id)}
                disabled={triggerResearch.isPending}
                className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {triggerResearch.isPending ? "Starting…" : "Research now"}
              </button>
              <button
                onClick={() => setScheduleOpen(true)}
                className="rounded border border-gray-300 px-4 py-2 text-sm"
              >
                Schedule
              </button>
              <button
                onClick={() => deleteProduct.mutate(product.id, { onSuccess: () => navigate({ to: "/" }) })}
                disabled={deleteProduct.isPending}
                className="rounded border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
          {(triggerResearch.error || deleteProduct.error) && (
            <p className="mt-2 text-sm text-red-600">{(triggerResearch.error ?? deleteProduct.error)?.message}</p>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Price history</h2>
            <div className="mt-2 rounded-lg border border-gray-200 bg-white p-4">
              <PriceHistoryChart points={points} targetPrice={product.target_price} currency={product.currency} />
            </div>
          </section>

          <section className="mt-8 mb-8">
            <h2 className="text-lg font-semibold">Research runs</h2>
            {runsQuery.isLoading && <p className="mt-2 text-gray-500">Loading…</p>}
            {runsQuery.error && <p className="mt-2 text-red-600">{runsQuery.error.message}</p>}
            {runs.length === 0 && !runsQuery.isLoading && (
              <p className="mt-2 text-gray-500">No research runs yet.</p>
            )}
            <div className="mt-2 flex flex-col gap-3">
              {[...runs]
                .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
                .map((run) => (
                  <RunCard key={run.id} run={run} />
                ))}
            </div>
          </section>

          {scheduleOpen && <ScheduleDialog product={product as ProductOut} onClose={() => setScheduleOpen(false)} />}
        </>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/products/$productId")({
  component: ProductDetailPage,
});
