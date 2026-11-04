import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  describeSchedule,
  useDeleteProduct,
  useProduct,
  useResearchRuns,
  useTriggerResearch,
  type ProductOut,
} from "../../api/purchasing";
import type { ResearchRunOut } from "../../api/generated";
import { AppShell } from "../../components/AppShell";
import { EditProductDialog } from "../../components/EditProductDialog";
import { PriceHistoryChart, type PricePoint } from "../../components/PriceHistoryChart";
import { ScheduleDialog } from "../../components/ScheduleDialog";
import { Button, StatusBadge, TargetBadge, errorBoxClass } from "../../components/ui";
import { fmtPrice, fmtTime } from "../../format";

const bestPriceOf = (run: ResearchRunOut): number | null => {
  if (run.best_price != null) return run.best_price;
  const prices = (run.findings ?? []).map((f) => f.price).filter((p): p is number => p != null);
  return prices.length > 0 ? Math.min(...prices) : null;
};

const RunCard = ({ run }: { run: ResearchRunOut }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={run.status} />
        <span className="text-xs text-gray-500">{run.trigger}</span>
        <span className="text-xs text-gray-500">
          {fmtTime(run.started_at)} → {fmtTime(run.finished_at)}
        </span>
        {run.target_met != null && <TargetBadge met={run.target_met} />}
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
                      {finding.original_price != null && finding.original_price > (finding.price ?? 0) && (
                        <s className="mr-1 text-gray-400">{fmtPrice(finding.original_price, finding.currency)}</s>
                      )}
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
  const [editOpen, setEditOpen] = useState(false);

  const runs = runsQuery.data ?? [];
  const points: PricePoint[] = [...runs]
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
    .map((run) => ({ time: run.started_at, price: bestPriceOf(run) }))
    .filter((p): p is PricePoint => p.price != null);

  return (
    <AppShell>
      <Link to="/" className="inline-flex items-center gap-1 rounded text-sm text-gray-600 hover:text-gray-900 hover:underline">
        ← All products
      </Link>

      {isLoading && <p className="mt-6 text-gray-500">Loading…</p>}
      {error && (
        <div role="alert" className={`mt-6 ${errorBoxClass}`}>
          {error.message}
        </div>
      )}

      {product && (
        <>
          <div className="mt-4 flex flex-wrap items-start gap-4">
            {product.has_image ? (
              <img
                src={`/api/v1/products/${product.id}/image`}
                alt={product.name}
                className="h-28 w-28 rounded-lg object-cover"
              />
            ) : product.image_url ? (
              <img src={product.image_url} alt={product.name} className="h-28 w-28 rounded-lg object-cover" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-gray-100 text-3xl">
                📦
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
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
                  Schedule: {describeSchedule(product.schedule)}
                  {product.schedule.enabled ? "" : " (paused)"}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="px-4 py-2"
                onClick={() => triggerResearch.mutate(product.id)}
                disabled={triggerResearch.isPending || runs[0]?.status === "running"}
              >
                {runs[0]?.status === "running" ? "Running…" : triggerResearch.isPending ? "Starting…" : "Research now"}
              </Button>
              <Button variant="secondary" className="px-4 py-2" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <Button variant="secondary" className="px-4 py-2" onClick={() => setScheduleOpen(true)}>
                Schedule
              </Button>
              <Button
                variant="danger"
                className="px-4 py-2"
                onClick={() => deleteProduct.mutate(product.id, { onSuccess: () => navigate({ to: "/" }) })}
                disabled={deleteProduct.isPending}
              >
                Delete
              </Button>
            </div>
          </div>
          {(triggerResearch.error || deleteProduct.error) && (
            <div role="alert" className={`mt-2 ${errorBoxClass}`}>
              {(triggerResearch.error ?? deleteProduct.error)?.message}
            </div>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight">Price history</h2>
            <div className="mt-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <PriceHistoryChart points={points} targetPrice={product.target_price} currency={product.currency} />
            </div>
          </section>

          <section className="mt-8 mb-8">
            <h2 className="text-lg font-semibold tracking-tight">Research runs</h2>
            {runsQuery.isLoading && <p className="mt-2 text-gray-500">Loading…</p>}
            {runsQuery.error && (
              <div role="alert" className={`mt-2 ${errorBoxClass}`}>
                {runsQuery.error.message}
              </div>
            )}
            {runs.length === 0 && !runsQuery.isLoading && <p className="mt-2 text-gray-500">No research runs yet.</p>}
            <div className="mt-2 flex flex-col gap-3">
              {[...runs]
                .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
                .map((run) => (
                  <RunCard key={run.id} run={run} />
                ))}
            </div>
          </section>

          {editOpen && <EditProductDialog product={product as ProductOut} onClose={() => setEditOpen(false)} />}
          {scheduleOpen && <ScheduleDialog product={product as ProductOut} onClose={() => setScheduleOpen(false)} />}
        </>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/products/$productId")({
  component: ProductDetailPage,
});
