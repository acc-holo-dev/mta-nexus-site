import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for MTA master directory stale notice ErrorState. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "site/src/features/servers/components/mta-master-server-directory.tsx";

it("locks master directory stale notice to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="mta-master-directory-stale"');
  expect(source).toMatch(/<ErrorState id="mta-master-directory-stale" title=\{copy\.stale\}/);
  expect(source).not.toContain(
    'className="nexus-panel bg-warning-soft p-4 text-sm text-secondary"',
  );
});
