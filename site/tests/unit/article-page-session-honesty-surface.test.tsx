import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/community/server/article-page.tsx"),
  "utf8",
);

/** Honesty lock: session probe failure ≠ guest for follow/report/discussion. */
it("locks article session probe failure away from guest-lie controls", () => {
  expect(source).toContain("sessionFailed");
  expect(source).toMatch(
    /getSession\([\s\S]*?\)\s*\.catch\(\(\)\s*=>\s*\{\s*sessionFailed = true;\s*return null;\s*\}\)/u,
  );
  expect(source).toContain("identityUnavailable={sessionFailed}");
  expect(source).toContain('id="article-session-unavailable"');
  expect(source).toContain("error: true");
  expect(source).toMatch(/sessionFailed\s*\?\s*Promise\.resolve\(null\)/u);
});
