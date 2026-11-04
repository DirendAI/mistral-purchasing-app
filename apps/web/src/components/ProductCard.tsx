import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { MouseEvent } from "react";

import { describeSchedule, useDeleteProduct, useTriggerResearch, type ProductOut } from "../api/purchasing";

const fmtPrice = (price: number | null | undefined, currency: string | null | undefined) =>
  price == null ? "—" : `${price.toFixed(2)} ${currency ?? ""}`.trim();

const fmtTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString() : "—";

export const ProductCard = ({
  product,
  onSchedule,
}: {
  product: ProductOut;
  onSchedule: (product: ProductOut) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const triggerResearch = useTriggerResearch();
  const deleteProduct = useDeleteProduct();
  const run = product.latest_run;

  // The card navigates to the detail page; buttons must not trigger that navigation.
  const guard = (handler?: () => void) => (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    handler?.();
  };

  return (
    <Link
      to="/products/$productId"
      params={{ productId: product.id }}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-gray-400"
    >
      <div className="flex items-start gap-3">
        {product.has_image ? (
          <img
            src={`/api/v1/products/${product.id}/image`}
            alt={product.name}
            className="h-20 w-20 rounded object-cover"
          />
        ) : product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-20 w-20 rounded object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded bg-gray-100 text-2xl">📦</div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{product.name}</h3>
          {product.target_price != null && (
            <p className="text-sm text-gray-600">
              Target: {fmtPrice(product.target_price, product.currency)}
            </p>
          )}
          {product.source_url && (
            <p className="truncate text-xs text-gray-500">
              Seen at{" "}
              <a className="underline" href={product.source_url} target="_blank" rel="noreferrer">
                {product.source_url}
              </a>
            </p>
          )}
          {product.product_url && (
            <p className="truncate text-xs text-gray-500">
              <a className="underline" href={product.product_url} target="_blank" rel="noreferrer">
                Product page
              </a>
            </p>
          )}
        </div>
      </div>

      <div className="rounded bg-gray-50 p-3 text-sm">
        {run == null ? (
          <p className="text-gray-500">No research yet.</p>
        ) : (
          <>
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
              <span className="text-xs text-gray-500">
                {run.trigger} · {fmtTime(run.finished_at ?? run.started_at)}
              </span>
              {run.target_met != null && (
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    run.target_met ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {run.target_met ? "target price reached" : "above target"}
                </span>
              )}
            </div>
            {run.error && <p className="mt-1 text-xs text-red-600">{run.error}</p>}
            {run.summary && <p className="mt-1 text-gray-700">{run.summary}</p>}
            {run.status === "completed" && (
              <p className="mt-1 font-medium">
                Best: {fmtPrice(run.best_price, product.currency)} {run.best_store ? `at ${run.best_store}` : ""}
              </p>
            )}
            {run.findings && run.findings.length > 0 && (
              <button className="mt-1 text-xs underline" onClick={guard(() => setExpanded((v) => !v))}>
                {expanded ? "Hide" : "Show"} {run.findings.length} finding(s)
              </button>
            )}
            {expanded && run.details && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer underline">Raw researcher notes</summary>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-100 p-2">
                  {run.details}
                </pre>
              </details>
            )}
            {expanded && run.findings && (
              <ul className="mt-2 flex flex-col gap-1 text-xs">
                {run.findings.map((finding) => (
                  <li key={finding.id} className="rounded border border-gray-200 bg-white p-2">
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
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          onClick={guard(() => triggerResearch.mutate(product.id))}
          disabled={triggerResearch.isPending || run?.status === "running"}
          className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
        >
          {run?.status === "running" ? "Running…" : triggerResearch.isPending ? "Starting…" : "Research now"}
        </button>
        <button
          onClick={guard(() => onSchedule(product))}
          className="rounded border border-gray-300 px-3 py-1.5"
        >
          Schedule{product.schedule ? (product.schedule.enabled ? " ✓" : " (paused)") : ""}
        </button>
        {product.schedule && (
          <span className="text-xs text-gray-500">{describeSchedule(product.schedule)}</span>
        )}
        <button
          onClick={guard(() => deleteProduct.mutate(product.id))}
          disabled={deleteProduct.isPending}
          className="ml-auto rounded border border-red-300 px-3 py-1.5 text-red-700 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
      {(triggerResearch.error || deleteProduct.error) && (
        <p className="text-xs text-red-600">{(triggerResearch.error ?? deleteProduct.error)?.message}</p>
      )}
    </Link>
  );
};
