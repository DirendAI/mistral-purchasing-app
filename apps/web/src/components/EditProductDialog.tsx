import { useState } from "react";
import type { FormEvent } from "react";

import { useUpdateProduct, type ProductOut } from "../api/purchasing";
import type { ProductPatch } from "../api/generated";
import { Button, Dialog, errorBoxClass, inputClass } from "./ui";

export const EditProductDialog = ({ product, onClose }: { product: ProductOut; onClose: () => void }) => {
  const updateProduct = useUpdateProduct(product.id);
  const [name, setName] = useState(product.name);
  const [imageUrl, setImageUrl] = useState(product.image_url ?? "");
  const [sourceUrl, setSourceUrl] = useState(product.source_url ?? "");
  const [productUrl, setProductUrl] = useState(product.product_url ?? "");
  const [targetPrice, setTargetPrice] = useState(product.target_price != null ? String(product.target_price) : "");
  const [currency, setCurrency] = useState(product.currency ?? "EUR");
  const [aiContext, setAiContext] = useState(product.ai_context ?? "");
  const [clearImage, setClearImage] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body: ProductPatch = {
      name,
      image_url: imageUrl || null,
      source_url: sourceUrl || null,
      product_url: productUrl || null,
      target_price: targetPrice === "" ? null : Number(targetPrice),
      currency: currency || null,
      ai_context: aiContext || null,
    };
    if (product.has_image) {
      body.clear_image = clearImage;
    }
    updateProduct.mutate(body, { onSuccess: onClose });
  };

  return (
    <Dialog title={`Edit product — ${product.name}`} onClose={onClose}>
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
        {product.has_image && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={clearImage} onChange={(e) => setClearImage(e.target.checked)} />
            Remove the uploaded photo
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Photo URL</span>
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
        {updateProduct.error && (
          <div role="alert" className={errorBoxClass}>
            {updateProduct.error.message}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={updateProduct.isPending || name.trim() === ""}>
            {updateProduct.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
