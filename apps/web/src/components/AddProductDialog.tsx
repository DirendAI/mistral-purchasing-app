import { useState } from "react";
import type { FormEvent } from "react";

import { useCreateProduct } from "../api/purchasing";
import { Button, Dialog, errorBoxClass, inputClass } from "./ui";

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
    <Dialog title="Add a product to track" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Name *</span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={300}
            autoFocus
          />
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
          <input
            className={inputClass}
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Store page where you saw it</span>
          <input
            className={inputClass}
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://store.example/…"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Product URL (entered manually)</span>
          <input
            className={inputClass}
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            placeholder="https://…"
          />
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
        {createProduct.error && (
          <div role="alert" className={errorBoxClass}>
            {createProduct.error.message}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={createProduct.isPending || name.trim() === ""}>
            {createProduct.isPending ? "Adding…" : "Add product"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
