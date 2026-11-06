import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/organization-ownership-transfer.tsx"),
  "utf8",
);

/** Honesty lock for organization ownership transfer failure. */
it("locks organization-ownership-transfer-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="organization-ownership-transfer-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="organization-ownership-transfer-unavailable"\s+title=\{error\}/u,
  );
});
