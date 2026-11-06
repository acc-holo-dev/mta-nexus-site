import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for workspace-resource-copy-receipt-unavailable notice. */
it("locks workspace-resource-copy-receipt-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/workspace/resources/[id]/copies/[receiptId]/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="workspace-resource-copy-receipt-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-resource-copy-receipt-unavailable"\s+title=\{c\.loadUnavailable\}/u,
  );
});
