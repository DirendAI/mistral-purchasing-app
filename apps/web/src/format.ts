export const fmtPrice = (price: number | null | undefined, currency: string | null | undefined) =>
  price == null ? "—" : `${price.toFixed(2)} ${currency ?? ""}`.trim();

export const fmtTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "—");
