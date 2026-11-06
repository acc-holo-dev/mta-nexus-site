import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for public user trust load-unavailable notice. */
it("locks user trust unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/users/[username]/trust/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="user-trust-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="user-trust-unavailable"\s+title=\{copy\.unavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.unavailable}</p>');
});
