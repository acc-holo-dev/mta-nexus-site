import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks Home panel load-unavailable ErrorStates to recovery hints", () => {
  const home = read("site/src/app/page.tsx");
  expect(home).toContain("dictionary.home.personalErrorHint");
  expect(home).toContain("dictionary.home.directoryPanelUnavailableHint");
  expect(home).toContain("dictionary.market.loadUnavailableHint");
  expect(home).toContain("dictionary.home.updatesLoadUnavailableHint");
  expect(read("site/src/lib/i18n/en/discovery.ts")).toContain("directoryPanelUnavailableHint:");
  expect(read("site/src/lib/i18n/ru/discovery.ts")).toContain("updatesLoadUnavailableHint:");
  expect(read("site/src/lib/i18n/en/discovery.ts")).toContain("personalErrorHint:");
});

it("locks downloads/trust/verification/author/mta-directory recovery hints", () => {
  expect(read("site/src/features/library/server/library-downloads-screen.tsx")).toMatch(
    /title=\{copy\.loadUnavailable\}\s*\n\s*description=\{copy\.loadUnavailableHint\}/u,
  );
  expect(read("site/src/features/trust/server/public-user-trust-page.tsx")).toMatch(
    /title=\{copy\.unavailable\}\s*\n\s*description=\{copy\.unavailableHint\}/u,
  );
  expect(read("site/src/features/community/server/author-edit-page.tsx")).toMatch(
    /title=\{copy\.unavailable\}\s*\n\s*description=\{copy\.unavailableHint\}/u,
  );
  expect(read("site/src/features/moderation/components/verification-workspace.tsx")).toContain(
    "description={copy.unavailableHint}",
  );
  expect(read("site/src/features/servers/components/mta-master-server-directory.tsx")).toContain(
    "description={copy.unavailableHint}",
  );
  expect(read("site/src/features/resources/resource-deliveries-i18n.ts")).toContain(
    "loadUnavailableHint:",
  );
  expect(read("site/src/features/trust/public-user-trust-copy.ts")).toContain("unavailableHint:");
  expect(read("site/src/features/trust/verification-workspace-copy.ts")).toContain(
    "unavailableHint:",
  );
  expect(read("site/src/features/community/author-publication-desk-copy.ts")).toContain(
    "unavailableHint:",
  );
  expect(read("site/src/lib/i18n/en/workspace.ts")).toContain("unavailableHint:");
  expect(read("site/src/lib/i18n/ru/workspace.ts")).toContain("unavailableHint:");
});
