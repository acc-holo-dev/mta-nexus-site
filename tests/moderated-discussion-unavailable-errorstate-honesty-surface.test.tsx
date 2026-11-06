import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for moderated discussion session-load unavailable notice. */
it("locks moderated discussion unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "moderated-discussion-screen.tsx"), "utf8");
  expect(source).toContain('id="moderated-discussion-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="moderated-discussion-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.loadUnavailable}</p>');
});
