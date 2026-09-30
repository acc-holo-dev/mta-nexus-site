import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("resource detail acquisition and delivery UI", () => {
  it("routes free resources through acquisition and disables paid legacy resources", () => {
    const page = read("apps/web/src/app/market/[slug]/page.tsx");

    expect(page).toContain('href={`/acquire?productId=${product.id}`}');
    expect(page).not.toContain('/checkout?productId=');
    expect(page).toContain("product.price === 0");
    expect(page).toContain("dictionary.checkout.paidDisabled");
  });

  it("shows one latest-build download action instead of one per history row", () => {
    const page = read("apps/web/src/app/market/[slug]/page.tsx");
    expect(page.match(/<ResourceDownloadButton\b/g)).toHaveLength(1);
    expect(page).toContain("productId={product.id}");
    expect(page).toContain("copy.latestBuildNotice");
    expect(page).not.toContain("buildRepository");
  });

  it("uses semantic theme tokens instead of the old hard-coded palette", () => {
    const page = read("apps/web/src/app/market/[slug]/page.tsx");

    for (const legacyClass of [
      "bg-blue-600",
      "bg-emerald-600",
      "bg-neutral-900",
      "text-neutral-",
      "border-neutral-",
      "bg-amber-950",
    ]) {
      expect(page).not.toContain(legacyClass);
    }
    expect(page).toContain("bg-accent");
    expect(page).toContain("bg-success-soft");
    expect(page).toContain("border-base");
  });
});
