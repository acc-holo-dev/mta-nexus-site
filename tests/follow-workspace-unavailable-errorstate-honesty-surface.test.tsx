import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** Honesty lock for follow-workspace-unavailable notice. */
it("locks follow-workspace-unavailable to ErrorState", () => {
  const source = readFileSync(
    join(process.cwd(), "apps/web/src/components/follow-workspace.tsx"),
    "utf8",
  );
  expect(source).toContain('id="follow-workspace-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="follow-workspace-unavailable"[\s\S]*?title=\{error\}/u);
});
