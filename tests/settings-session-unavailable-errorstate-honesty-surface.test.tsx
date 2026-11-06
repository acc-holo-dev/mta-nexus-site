import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for settings active-sessions unavailable notice. */
it("locks settings session unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "settings-active-sessions.tsx"), "utf8");
  expect(source).toContain('id="settings-session-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="settings-session-unavailable"\s+title=\{copy\.sessionUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.sessionUnavailable}</p>');
});
