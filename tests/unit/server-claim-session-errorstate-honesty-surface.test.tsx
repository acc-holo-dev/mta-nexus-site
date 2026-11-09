import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "apps/web/src/app/servers/[slug]/page.tsx"), "utf8");

/** Honesty lock for server detail claim-session lookup failure. */
it("locks claim-session lookup failure to ErrorState without soft status", () => {
  expect(source).toContain('import { ErrorState, TrustBadge } from "@nexus/ui"');
  expect(source).toContain("claimViewer === undefined");
  expect(source).toMatch(
    /claimViewer === undefined \? \(\s*<ErrorState\s+id="server-claim-session-unavailable"\s+title=\{/u,
  );
  expect(source).toContain("Could not check the session for server verification.");
  expect(source).not.toMatch(/claimViewer === undefined \? \(\s*<p role="status">/u);
});
