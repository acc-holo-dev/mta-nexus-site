import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for workspace reactions unavailable publication notice. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "site/src/app/workspace/reactions/page.tsx";

it("locks unavailable publication titles to ErrorState alert", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="workspace-reactions-publication-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="workspace-reactions-publication-unavailable"\s+title=\{copy\.hidden\}\s+description=\{copy\.hiddenDescription\}/u,
  );
  expect(source).not.toContain('className="font-semibold text-muted">{copy.hidden}</p>');
  expect(source).not.toContain('className="text-xs text-muted">{copy.hiddenDescription}</p>');
});
