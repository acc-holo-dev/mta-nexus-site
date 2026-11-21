import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/commerce/server/purchase-operations-screen.tsx"),
  "utf8",
);

/** Honesty lock: order operations cannotCancel muted note → ErrorState. */
it("locks order operations cannotCancel blocker to ErrorState", () => {
  expect(source).toMatch(/import \{[^}]*\bErrorState\b[^}]*\} from "@nexus\/ui"/u);
  expect(source).toContain('id="order-operations-cannot-cancel"');
  expect(source).toContain("copy.cannotCancel");
  expect(source).toContain("copy.cancelledPayment");
  expect(source).not.toContain('className="text-sm text-muted"');
  expect(source).not.toMatch(/<!result\.canCancel && \(\s*<p className="text-sm text-muted">/u);
  expect(source).not.toMatch(/<ErrorState id="order-operations-cannot-cancel"[^>]*action=/u);
});
