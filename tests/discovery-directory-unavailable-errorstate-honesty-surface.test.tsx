import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for discovery-directory-unavailable notice. */
it("locks discovery-directory-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/discovery-directory.tsx"),
    "utf8",
  );
  expect(source).toContain('id="discovery-directory-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="discovery-directory-unavailable"[\s\S]*?title=\{loadError\}/u,
  );
});
