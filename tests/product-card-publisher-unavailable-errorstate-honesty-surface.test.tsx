import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for product-card publisherUnavailable ErrorState. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "apps/web/src/components/product-card.tsx";

it("locks product-card publisher unavailable notice to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="product-card-publisher-unavailable"');
  expect(source).toMatch(
    /<ErrorState id="product-card-publisher-unavailable" title=\{unavailable\}/,
  );
  expect(source).not.toContain('className="truncate text-[11px] text-faint">{unavailable}</span>');
});
