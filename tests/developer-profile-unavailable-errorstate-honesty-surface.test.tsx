import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for developer profile load-unavailable notice. */
it("locks developer profile unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/developers/[username]/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="developer-profile-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="developer-profile-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.loadUnavailable}</p>');
});
