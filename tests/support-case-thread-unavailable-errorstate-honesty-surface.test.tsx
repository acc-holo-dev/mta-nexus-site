import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for support-case-thread-unavailable notice. */
it("locks support-case-thread-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/support-case-thread.tsx"),
    "utf8",
  );
  expect(source).toContain('id="support-case-thread-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="support-case-thread-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
