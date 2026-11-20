import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks server history/updates unavailable ErrorStates to recovery hints", () => {
  const history = read("site/src/features/servers/server/server-history-panel.tsx");
  expect(history).toContain("copy.unavailable");
  expect(history).toContain("copy.unavailableHint");
  expect(history).toMatch(
    /title=\{copy\.unavailable\}\s*\n\s*description=\{copy\.unavailableHint\}/u,
  );

  const updates = read("site/src/features/servers/server/server-updates-panel.tsx");
  expect(updates).toContain("copy.unavailable");
  expect(updates).toContain("copy.unavailableHint");
  expect(updates).toMatch(
    /title=\{copy\.unavailable\}\s*\n\s*description=\{copy\.unavailableHint\}/u,
  );

  expect(read("site/src/lib/i18n/en/servers.ts")).toContain("unavailableHint:");
  expect(read("site/src/lib/i18n/ru/servers.ts")).toContain("unavailableHint:");
});
