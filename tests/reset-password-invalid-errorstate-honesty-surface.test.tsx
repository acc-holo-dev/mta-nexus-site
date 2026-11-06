import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for reset-password invalid token notice. */
it("locks reset-password invalid to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/app/auth/reset-password/page.tsx"),
    "utf8",
  );
  expect(source).toContain('id="reset-password-invalid"');
  expect(source).toMatch(
    /<ErrorState\s+id="reset-password-invalid"\s+title=\{copy\.invalidReset\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.invalidReset}</p>');
});
