import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "site/src/app/page.tsx"), "utf8");

/** Home session probe failure must not hide personal strip as a signed-out guest. */
it("locks home session probe failure to ErrorState instead of guest null", () => {
  expect(source).toContain("sessionFailed");
  expect(source).toContain('id="home-session-unavailable"');
  expect(source).toMatch(/sessionFailed \? \(\s*<ErrorState\s+id="home-session-unavailable"/u);
  expect(source).not.toMatch(/getSession\([^)]*\)\s*\.catch\(\s*\(\)\s*=>\s*null\s*\)/u);
});
