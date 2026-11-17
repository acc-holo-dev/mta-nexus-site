import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/resources/server/detail-page.tsx"),
  "utf8",
);

/** Honesty lock: market detail session probe failure ≠ guest for follow/report/QA. */
it("locks product detail session probe failure to null auth, not guest CTAs", () => {
  expect(source).toContain("sessionFailed");
  expect(source).toMatch(
    /getSession\([\s\S]*?\)\.catch\(\(\)\s*=>\s*\{\s*sessionFailed = true;\s*return null;\s*\}\)/u,
  );
  expect(source).toContain("authenticated={sessionFailed ? null : Boolean(user)}");
  expect(source).toContain("error: true");
  expect(source).toContain("retryHref={detailReturnPath}");
});
