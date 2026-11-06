import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for community-topic-form-unavailable notice. */
it("locks community-topic-form-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/community-topic-form.tsx"),
    "utf8",
  );
  expect(source).toContain('id="community-topic-form-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="community-topic-form-unavailable"[\s\S]*?title=\{error\}/u,
  );
});
