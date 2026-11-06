import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for server updates panel unavailable notice. */
it("locks server updates unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "server-updates-panel.tsx"), "utf8");
  expect(source).toContain('id="server-updates-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="server-updates-unavailable"\s+title=\{copy\.unavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.unavailable}</p>');
});
