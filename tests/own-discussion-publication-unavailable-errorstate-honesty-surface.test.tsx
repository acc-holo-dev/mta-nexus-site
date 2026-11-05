import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for own-discussion unavailable publication notice. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "apps/web/src/components/own-discussion-detail.tsx";

it("locks unavailable publication notice to ErrorState alert", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="own-discussion-publication-unavailable"');
  expect(source).toMatch(
    /!comment\.available \? \(\s*<ErrorState id="own-discussion-publication-unavailable" title=\{copy\.hiddenNote\} \/>\s*\) : null/u,
  );
  expect(source).not.toContain('className="text-sm text-muted">{copy.hiddenNote}</p>');
});
