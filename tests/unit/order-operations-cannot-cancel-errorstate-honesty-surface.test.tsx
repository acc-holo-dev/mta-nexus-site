import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/app/workspace/purchases/[id]/operations/page.tsx"),
  "utf8",
);

/** Honesty lock: order operations cannotCancel muted note → ErrorState. */
it("locks order operations cannotCancel blocker to ErrorState", () => {
  expect(source).toContain('import { ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="order-operations-cannot-cancel"');
  expect(source).toContain("copy.cannotCancel");
  expect(source).toContain("copy.cancelledPayment");
  expect(source).not.toContain('className="text-sm text-muted"');
  expect(source).not.toMatch(/<!result\.canCancel && \(\s*<p className="text-sm text-muted">/u);
  expect(source).not.toMatch(/<ErrorState id="order-operations-cannot-cancel"[^>]*action=/u);
});
