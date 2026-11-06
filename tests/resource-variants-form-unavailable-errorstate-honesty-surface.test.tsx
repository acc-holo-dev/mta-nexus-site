import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for resource-variants-form-unavailable notice. */
it("locks resource-variants-form-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/resource-variants-form.tsx"),
    "utf8",
  );
  expect(source).toContain('id="resource-variants-form-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="resource-variants-form-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
