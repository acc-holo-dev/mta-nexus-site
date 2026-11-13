import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "site/src/app/page.tsx"), "utf8");

/** Honesty lock for home directory panel unavailable notice. */
it("locks home directory panel unavailable to ErrorState", () => {
  expect(source).toContain(
    'import { buttonClassName, ErrorState, SectionHeader } from "@nexus/ui"',
  );
  expect(source).toMatch(
    /directory \? \([\s\S]*?\) : \(\s*<ErrorState\s+id="home-directory-unavailable"\s+title=\{dictionary\.home\.directoryPanelUnavailable\}\s*\/>\s*\)/u,
  );
  expect(source).not.toMatch(
    /directory \? \([\s\S]*?\) : \(\s*<div className="nexus-panel p-8 text-center text-sm text-muted">\s*\{dictionary\.home\.directoryPanelUnavailable\}/u,
  );
});
