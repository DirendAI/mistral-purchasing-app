import { useState } from "react";
import type { FormEvent } from "react";

import { useCreateProduct } from "../api/purchasing";

const inputClass =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none";

export const AddProductDialog = ({ onClose }: { onClose: () => void }) => {
  const createProduct = useCreateProduct();
  const [name, setName] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [aiContext, setAiContext] = useState("");
  const [researchNow, setResearchNow] = useState(true);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createProduct.mutate(
      {
        name,
        image: image ?? undefined,
        image_url: imageUrl || null,
        source_url: sourceUrl || null,
        product_url: productUrl || null,
        target_price: targetPrice === "" ? null : Number(targetPrice),
        currency: currency || null,
        ai_context: aiContext || null,
        research_now: researchNow,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold">Add a product to track</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Name *</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={300} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Photo of the product</span>
          <input
            type="file"
            accept="image/*"
            className="text-sm"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">…or photo URL</span>
          <input className={inputClass} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Store page where you saw it</span>
          <input className={inputClass} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://store.example/…" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Product URL (entered manually)</span>
          <input className={inputClass} value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder="https://…" />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="font-medium">Target price</span>
            <input
              className={inputClass}
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              inputMode="decimal"
              placeholder="299.99"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Currency</span>
            <input className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={8} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Extra AI context</span>
          <textarea
            className={inputClass}
            rows={3}
            value={aiContext}
            onChange={(e) => setAiContext(e.target.value)}
            placeholder="e.g. must be the EU version, black, with 2-year warranty…"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={researchNow} onChange={(e) => setResearchNow(e.target.checked)} />
          Research prices right away
        </label>
        {createProduct.error && <p className="text-sm text-red-600">{createProduct.error.message}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={createProduct.isPending || name.trim() === ""}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {createProduct.isPending ? "Adding…" : "Add product"}
          </button>
        </div>
      </form>
    </div>
  );
};
