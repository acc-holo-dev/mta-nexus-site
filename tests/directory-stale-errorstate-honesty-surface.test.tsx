import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for MTA master directory stale notice ErrorState. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "site/src/components/mta-master-server-directory.tsx";

it("locks master directory stale notice to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="mta-master-directory-stale"');
  expect(source).toMatch(/<ErrorState id="mta-master-directory-stale" title=\{copy\.stale\}/);
  expect(source).not.toContain(
    'className="nexus-panel bg-warning-soft p-4 text-sm text-secondary"',
  );
});
