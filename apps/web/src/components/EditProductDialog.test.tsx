import { describe, expect, mock, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { ProductOut } from "../api/generated";

// The generated client builds `new Request(url)`, which needs an absolute URL outside a browser:
// give it a base before the module chain (env.ts reads it at load) is imported.
process.env.VITE_API_URL = "http://localhost";
const { EditProductDialog } = await import("./EditProductDialog");

const product = (overrides: Partial<ProductOut> = {}): ProductOut => ({
  id: "3f6b2c1a-9d4e-4c5b-8a7f-1e2d3c4b5a69",
  name: "Sony WH-1000XM5",
  has_image: true,
  image_url: "https://img.example/sony.png",
  source_url: "https://store.example/sony",
  product_url: "https://store.example/sony/xm5",
  target_price: 199.5,
  currency: "EUR",
  ai_context: "black, over-ear",
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-01T10:00:00Z",
  ...overrides,
});

const valueOf = (label: string): string => (screen.getByLabelText(label) as HTMLInputElement).value;

type CapturedRequest = { url: string; method: string; body: unknown };

/** Stubs fetch, captures the request the dialog sends, and answers with the patched product. */
const capturePatch = (answer: ProductOut): (() => CapturedRequest | undefined) => {
  let captured: CapturedRequest | undefined;

  // Bun's `fetch` type carries extra props (`preconnect`), so a plain function is not assignable to
  // `typeof fetch`; the assertion is safe because the runtime shape is just a callable.
  const stub = (async (input: RequestInfo | URL, init?: RequestInit) => {
    // The generated client hands fetch a `Request`, so method/url/body live on it, not on `init`.
    const request = input instanceof Request ? input : undefined;
    captured = {
      url: request?.url ?? String(input),
      method: request?.method ?? init?.method ?? "GET",
      body: JSON.parse((await request?.text()) ?? "null"),
    };
    return new Response(JSON.stringify(answer), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  spyOn(globalThis, "fetch").mockImplementation(stub);

  return () => captured;
};

const renderDialog = (p: ProductOut, onClose: () => void = () => {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <EditProductDialog product={p} onClose={onClose} />
    </QueryClientProvider>
  );
};

const submit = (container: HTMLElement) => {
  const form = container.querySelector("form");
  if (!form) throw new Error("the dialog renders no form");
  fireEvent.submit(form);
};

describe("EditProductDialog", () => {
  test("prefills the form from the product and saves edits, including the AI context", async () => {
    const p = product();
    const captured = capturePatch({ ...p, ai_context: "black, over-ear, EU version" });
    const onClose = mock(() => {});
    const { container } = renderDialog(p, onClose);

    expect(valueOf("Name *")).toBe("Sony WH-1000XM5");
    expect(valueOf("Photo URL")).toBe("https://img.example/sony.png");
    expect(valueOf("Store page where you saw it")).toBe("https://store.example/sony");
    expect(valueOf("Product URL (entered manually)")).toBe("https://store.example/sony/xm5");
    expect(valueOf("Target price")).toBe("199.5");
    expect(valueOf("Currency")).toBe("EUR");
    expect(valueOf("Extra AI context")).toBe("black, over-ear");

    fireEvent.change(screen.getByLabelText("Extra AI context"), { target: { value: "black, over-ear, EU version" } });
    fireEvent.change(screen.getByLabelText("Target price"), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("Remove the uploaded photo"));
    submit(container);

    await waitFor(() => expect(captured()).toBeDefined());
    const request = captured();
    expect(request?.method).toBe("PATCH");
    expect(request?.url).toBe(`http://localhost/api/v1/products/${p.id}`);
    expect(request?.body).toEqual({
      name: "Sony WH-1000XM5",
      image_url: "https://img.example/sony.png",
      source_url: "https://store.example/sony",
      product_url: "https://store.example/sony/xm5",
      target_price: null,
      currency: "EUR",
      ai_context: "black, over-ear, EU version",
      clear_image: true,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test("sends no clear_image for a product without an uploaded photo and clears an emptied AI context", async () => {
    const p = product({ has_image: false, image_url: null, ai_context: "black" });
    const captured = capturePatch({ ...p, ai_context: null });
    const { container } = renderDialog(p);

    expect(screen.queryByLabelText("Remove the uploaded photo")).toBeNull();

    fireEvent.change(screen.getByLabelText("Extra AI context"), { target: { value: "" } });
    submit(container);

    await waitFor(() => expect(captured()).toBeDefined());
    expect(captured()?.body).toMatchObject({ ai_context: null });
    expect(captured()?.body).not.toHaveProperty("clear_image");
  });
});
