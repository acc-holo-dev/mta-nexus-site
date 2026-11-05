import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for library membership history unknown/unavailable ErrorState. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "apps/web/src/components/library-membership-history-item.tsx";

it("locks membership history unknown and unavailable notices to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="library-membership-history-unknown"');
  expect(source).toContain('id="library-membership-history-unavailable"');
  expect(source).toMatch(
    /<ErrorState id="library-membership-history-unknown" title=\{h\.unknown\}/,
  );
  expect(source).not.toContain("<p>{h.unknown}</p>");
  expect(source).not.toContain("? (resource.currentTitle ?? h.unavailable)");
});
