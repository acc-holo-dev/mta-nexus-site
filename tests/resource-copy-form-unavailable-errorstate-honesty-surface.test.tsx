import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for resource-copy-form-unavailable notice. */
it("locks resource-copy-form-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/resource-copy-form.tsx"),
    "utf8",
  );
  expect(source).toContain('id="resource-copy-form-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="resource-copy-form-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
