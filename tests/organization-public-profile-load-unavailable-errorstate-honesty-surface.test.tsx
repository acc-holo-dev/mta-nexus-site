import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/app/organizations/[slug]/page.tsx"), "utf8");

/** Honesty lock for public organization profile load failure. */
it("locks organization-public-profile-load-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="organization-public-profile-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="organization-public-profile-load-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
});
