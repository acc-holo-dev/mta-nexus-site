import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/commerce/components/order-cancellation-form.tsx"),
  "utf8",
);
const copy = readFileSync(join(root, "site/src/features/commerce/commercial-i18n.ts"), "utf8");

/** Honesty lock: order cancellation unconfirmed retry role=note → ErrorState + dictionary copy. */
it("locks order cancellation unconfirmed retry to ErrorState", () => {
  expect(source).toContain('import { Button, ErrorState, fieldClassBlock } from "@nexus/ui"');
  expect(source).toContain('id="order-cancellation-unconfirmed"');
  expect(source).toContain("copy.previousRequestUnconfirmed");
  expect(source).toContain("copy.restoreFailed");
  expect(source).toContain("copy.recoverySaveFailed");
  expect(copy).toContain("previousRequestUnconfirmed:");
  expect(source).not.toContain(
    "The previous request was not confirmed. Retry only the saved request.",
  );
  expect(source).toMatch(
    /ready === scope && retry \? \(\s*<ErrorState\s+id="order-cancellation-unconfirmed"/u,
  );
  expect(source).not.toContain('<p role="note">');
  expect(source).not.toMatch(/ready === scope && retry && \(\s*<p role="note">/u);
  expect(source).not.toMatch(/id="order-cancellation-unconfirmed"[^>]*action=/u);
});
