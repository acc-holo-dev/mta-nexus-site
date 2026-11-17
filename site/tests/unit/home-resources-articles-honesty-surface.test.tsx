import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "site/src/app/page.tsx"), "utf8");

/** Home free resources / articles: empty ≠ load failure; silent catch must not look empty. */
it("locks home free-resource and updates empty vs unavailable surfaces", () => {
  expect(source).toContain("freeResourcesFailed");
  expect(source).toContain("articlesFailed");
  expect(source).toContain("nexusListingsFailed");
  expect(source).toContain('id="home-free-resources-unavailable"');
  expect(source).toContain('id="home-free-resources-empty"');
  expect(source).toContain('id="home-community-updates-unavailable"');
  expect(source).toContain('id="home-community-updates-empty"');
  expect(source).toContain("EmptyState");
  expect(source).not.toContain('className="nexus-panel p-8 text-center text-sm text-muted"');
});
