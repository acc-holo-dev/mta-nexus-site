import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "site/src/features/shell/server/home-page.tsx"), "utf8");

/** Honesty lock for home directory panel unavailable notice. */
it("locks home directory panel unavailable to ErrorState", () => {
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="home-directory-unavailable"');
  expect(source).toContain("dictionary.home.directoryPanelUnavailable");
  expect(source).toMatch(
    /directory \? \([\s\S]*?\) : \(\s*<ErrorState[\s\S]*?id="home-directory-unavailable"/u,
  );
  expect(source).not.toMatch(
    /directory \? \([\s\S]*?\) : \(\s*<div className="nexus-panel p-8 text-center text-sm text-muted">\s*\{dictionary\.home\.directoryPanelUnavailable\}/u,
  );
});
