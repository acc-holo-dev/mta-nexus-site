import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for per-item cart unavailable ErrorState. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "site/src/components/resource-cart-controls.tsx";

it("locks cart item unavailable title to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="resource-cart-item-unavailable"');
  expect(source).toMatch(
    /<ErrorState id="resource-cart-item-unavailable" title=\{copy\.unavailable\}/,
  );
  expect(source).not.toContain('className="text-danger">{copy.unavailable}</p>');
});
