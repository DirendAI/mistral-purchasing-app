import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { useProducts, type ProductOut } from "../api/purchasing";
import { AddProductDialog } from "../components/AddProductDialog";
import { AppShell } from "../components/AppShell";
import { ProductCard } from "../components/ProductCard";
import { ScheduleDialog } from "../components/ScheduleDialog";
import { Button, errorBoxClass } from "../components/ui";

const ProductSkeletons = () => (
  <div className="mt-6 grid gap-4 md:grid-cols-2" aria-label="Loading products">
    {[0, 1, 2].map((i) => (
      <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="h-20 w-20 rounded-lg bg-gray-200" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 w-2/3 rounded bg-gray-200" />
            <div className="h-3 w-1/3 rounded bg-gray-200" />
          </div>
        </div>
        <div className="mt-3 h-16 rounded-lg bg-gray-100" />
      </div>
    ))}
  </div>
);

const TrackingPage = () => {
  const { data: products, isLoading, error } = useProducts();
  const [addOpen, setAddOpen] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<ProductOut | null>(null);

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Tracked products</h1>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          + Add product
        </Button>
      </div>

      {isLoading && <ProductSkeletons />}
      {error && (
        <div role="alert" className={`mt-6 ${errorBoxClass}`}>
          {error.message}
        </div>
      )}
      {products && products.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <span aria-hidden className="text-4xl">
            📦
          </span>
          <p className="max-w-md text-sm text-gray-600">
            Nothing tracked yet. Add a product with a photo or a store link and the app will research prices
            near you.
          </p>
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            + Add your first product
          </Button>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {products?.map((product) => (
          <ProductCard key={product.id} product={product} onSchedule={setScheduleFor} />
        ))}
      </div>

      {addOpen && <AddProductDialog onClose={() => setAddOpen(false)} />}
      {scheduleFor && <ScheduleDialog product={scheduleFor} onClose={() => setScheduleFor(null)} />}
    </AppShell>
  );
};

export const Route = createFileRoute("/")({
  staticData: { landing: true },
  component: TrackingPage,
});
