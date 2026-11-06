import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for support-center-form-unavailable notice. */
it("locks support-center-form-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/support-center.tsx"),
    "utf8",
  );
  expect(source).toContain('id="support-center-form-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="support-center-form-unavailable"[\s\S]*?title=\{formError\}/u,
  );
});
