import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for notifications session-load unavailable notice. */
it("locks notifications unavailable to ErrorState", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/src/app/notifications/page.tsx"), "utf8");
  expect(source).toContain('id="notifications-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="notifications-unavailable"\s+title=\{copy\.unavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.unavailable}</p>');
});
