import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks managed-servers load-unavailable ErrorState to recovery hint", () => {
  const page = read("site/src/app/workspace/servers/page.tsx");
  expect(page).toContain("workspace.unavailable");
  expect(page).toContain("workspace.unavailableHint");
  expect(page).toMatch(
    /title=\{workspace\.unavailable\}\s*\n\s*description=\{workspace\.unavailableHint\}/u,
  );

  const copy = read("site/src/features/servers/server-workspace-copy.ts");
  expect(copy).toContain("unavailableHint:");
});
