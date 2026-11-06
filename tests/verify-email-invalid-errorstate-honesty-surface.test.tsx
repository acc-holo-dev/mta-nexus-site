import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for verify-email invalid token notice. */
it("locks verify-email invalid to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/auth/verify-email/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="verify-email-invalid"');
  expect(source).toMatch(
    /<ErrorState\s+id="verify-email-invalid"\s+title=\{copy\.invalidVerification\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.invalidVerification}</p>');
});
