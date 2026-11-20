import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "site/src/features/servers/server/server-detail-screen.tsx"), "utf8");

/** Honesty lock: server detail session probe failure keeps followViewer undefined. */
it("locks server detail session probe failure away from guest follow/claim lies", () => {
  expect(source).toContain("followViewer = undefined");
  expect(source).toContain("claimViewer = undefined");
  expect(source).toContain('id="server-claim-session-unavailable"');
  expect(source).toContain("copy.claimSessionUnavailable");
  expect(source).toContain(
    "authenticated={followViewer === undefined ? null : Boolean(reportViewer)}",
  );
  expect(source).not.toMatch(/Could not check the session for server verification\./u);
});
