import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/mta-meta-inspector-panel.tsx"),
  "utf8",
);

/** Honesty lock for mta meta inspector result error. */
it("locks mta-meta-inspector-error-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="mta-meta-inspector-error-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="mta-meta-inspector-error-unavailable"[\s\S]*?title=\{result\.error\}/u,
  );
});
