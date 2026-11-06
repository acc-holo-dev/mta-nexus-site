import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for home-personal-changes-unavailable notice. */
it("locks home-personal-changes-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/home-personal-changes-panel.tsx"),
    "utf8",
  );
  expect(source).toContain('id="home-personal-changes-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="home-personal-changes-unavailable"[\s\S]*?title=\{copy.error\}/u,
  );
});
