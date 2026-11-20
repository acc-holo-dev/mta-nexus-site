import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks server review load-unavailable ErrorState to recovery hint", () => {
  const panel = read("site/src/features/servers/components/server-review-panel.tsx");
  expect(panel).toContain("loadCopy.unavailable");
  expect(panel).toContain("loadCopy.unavailableHint");
  expect(panel).toMatch(
    /title=\{loadCopy\.unavailable\}\s*\n\s*description=\{loadCopy\.unavailableHint\}/u,
  );

  const i18n = read("site/src/features/servers/server-review-i18n.ts");
  expect(i18n).toContain("loadUnavailableHint:");
  expect(i18n).toContain("unavailableHint: copy.loadUnavailableHint");
});
