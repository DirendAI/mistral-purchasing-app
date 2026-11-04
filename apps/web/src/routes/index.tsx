import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { useProducts, type ProductOut } from "../api/purchasing";
import { AddProductDialog } from "../components/AddProductDialog";
import { AppShell } from "../components/AppShell";
import { ProductCard } from "../components/ProductCard";
import { ScheduleDialog } from "../components/ScheduleDialog";

const TrackingPage = () => {
  const { data: products, isLoading, error } = useProducts();
  const [addOpen, setAddOpen] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<ProductOut | null>(null);

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tracked products</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          + Add product
        </button>
      </div>

      {isLoading && <p className="mt-6 text-gray-500">Loading…</p>}
      {error && <p className="mt-6 text-red-600">{error.message}</p>}
      {products && products.length === 0 && (
        <p className="mt-6 text-gray-500">
          Nothing tracked yet. Add a product with a photo or a store link and the app will research prices near you.
        </p>
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
