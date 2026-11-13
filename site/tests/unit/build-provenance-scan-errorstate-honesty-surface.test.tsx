import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for build-provenance non-clean scan ErrorState. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "site/src/components/build-provenance-details.tsx";

it("locks non-clean build provenance scan notices to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain("build-provenance-scan-blocked");
  expect(source).toContain("build-provenance-scanner-unavailable");
  expect(source).toContain("build-provenance-scan-not-recorded");
  expect(source).toMatch(/title=\{scanLabel\}/);
  expect(source).not.toMatch(/toneClass\[provenance\.scanTone\][\s\S]*\{scanLabel\}/);
});
