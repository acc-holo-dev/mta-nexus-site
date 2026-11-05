import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/resource-cart-controls.tsx"),
  "utf8",
);

it("locks cart uncertain pending and unavailable notices to ErrorState", () => {
  expect(source).toContain('import { Button, EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain("<ErrorState title={receiptCopy.pending} />");
  expect(source).toContain("<ErrorState title={copy.unavailableNote} />");
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
