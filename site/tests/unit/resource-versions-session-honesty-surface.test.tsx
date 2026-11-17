import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/resources/server/versions-page.tsx"),
  "utf8",
);

/** Public versions: session probe failure must not look like a signed-out acquire/guest CTA. */
it("locks public versions session probe failure away from guest auth links", () => {
  expect(source).toContain("sessionFailed");
  expect(source).toMatch(
    /try \{\s*user = await authService\.getSession\([\s\S]*?\}\s*catch \{\s*sessionFailed = true;/u,
  );
  expect(source).toMatch(/sessionFailed \?\s*\([\s\S]*?<ErrorState/u);
  expect(source).not.toMatch(/getSession\([^)]*\)\s*\.catch\(\s*\(\)\s*=>\s*null\s*\)/u);
});
