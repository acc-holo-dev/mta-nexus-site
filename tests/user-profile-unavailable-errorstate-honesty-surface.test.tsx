import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for public user profile load-unavailable notice. */
it("locks user profile unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/users/[username]/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="user-profile-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="user-profile-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.loadUnavailable}</p>');
});
