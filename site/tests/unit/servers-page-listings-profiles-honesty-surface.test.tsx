import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/servers/server/servers-page.tsx"),
  "utf8",
);

/** Honesty lock: a failed NEXUS listings read is not an empty profile map. */
it("locks servers page listing load failure to ErrorState instead of catch([])", () => {
  expect(source).toContain(".catch(() => null)");
  expect(source).not.toContain(".catch(() => [])");
  expect(source).toContain('id="servers-listings-profiles-unavailable"');
  expect(source).toContain("listingsProfilesUnavailable");
  expect(source).toContain("listingsProfilesUnavailableHint");
  expect(source).toMatch(
    /listings === null \? \(\s*<ErrorState[\s\S]*?id="servers-listings-profiles-unavailable"/u,
  );
  expect(source).toContain('href="/servers"');
});
