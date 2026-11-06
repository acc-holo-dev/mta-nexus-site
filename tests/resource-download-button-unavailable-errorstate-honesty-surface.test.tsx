import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for resource-download-button-unavailable notice. */
it("locks resource-download-button-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/resource-download-button.tsx"),
    "utf8",
  );
  expect(source).toContain('id="resource-download-button-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="resource-download-button-unavailable"[\s\S]*?title=\{unavailableReason\}/u,
  );
});
