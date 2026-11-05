import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for per-item cart unavailable ErrorState. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "apps/web/src/components/resource-cart-controls.tsx";

it("locks cart item unavailable title to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="resource-cart-item-unavailable"');
  expect(source).toMatch(
    /<ErrorState id="resource-cart-item-unavailable" title=\{copy\.unavailable\}/,
  );
  expect(source).not.toContain('className="text-danger">{copy.unavailable}</p>');
});
