import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "site/src/components/resource-cart-controls.tsx"), "utf8");

it("locks cart uncertain pending and unavailable notices to ErrorState", () => {
  expect(source).toContain('import { Button, EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain("<ErrorState title={receiptCopy.pending} />");
  expect(source).toContain('id="resource-cart-unavailable"');
  expect(source).toMatch(
    /unavailable \? \(\s*<ErrorState id="resource-cart-unavailable" title=\{copy\.unavailableNote\} \/>\s*\) : null/u,
  );
  expect(source).toContain('data-cart-state="pending"');
  expect(source).not.toContain('className="text-sm text-warning"');
  expect(source).not.toContain('role="alert"');
});

it("keeps successful cart receipt confirmation on role=status", () => {
  expect(source).toContain('data-cart-state="receipt"');
  expect(source).toContain('role="status"');
  expect(source).toContain("bg-success-soft");
  expect(source).toContain("text-success");
  expect(source).toMatch(
    /role="status"\s+className="rounded-lg bg-success-soft p-4 text-sm text-success"/u,
  );
});
