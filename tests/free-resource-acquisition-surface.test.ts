import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));

import CheckoutCompatibilityRedirect from "../apps/web/src/app/checkout/page";

describe("free resource acquisition compatibility redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves a single product id when redirecting legacy checkout", async () => {
    await CheckoutCompatibilityRedirect({
      searchParams: Promise.resolve({ productId: "prd free/1" }),
    });

    expect(redirect).toHaveBeenCalledWith("/acquire?productId=prd%20free%2F1");
  });

  it("uses only the first product id from a repeated query parameter", async () => {
    await CheckoutCompatibilityRedirect({
      searchParams: Promise.resolve({
        productId: ["prd_first", "prd_second"],
      }),
    });

    expect(redirect).toHaveBeenCalledWith("/acquire?productId=prd_first");
  });

  it("redirects an empty legacy checkout to the acquisition landing page", async () => {
    await CheckoutCompatibilityRedirect({
      searchParams: Promise.resolve({}),
    });

    expect(redirect).toHaveBeenCalledWith("/acquire");
  });
});
