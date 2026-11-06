import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for organization-profile-form-unavailable notice. */
it("locks organization-profile-form-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/organization-profile-form.tsx"),
    "utf8",
  );
  expect(source).toContain('id="organization-profile-form-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="organization-profile-form-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
