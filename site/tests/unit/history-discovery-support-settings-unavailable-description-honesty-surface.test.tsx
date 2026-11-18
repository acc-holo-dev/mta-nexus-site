import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const pages: Array<[string, string]> = [
  [
    "site/src/features/servers/server/server-workspace-history-screen.tsx",
    "copy.historyUnavailableHint",
  ],
  [
    "site/src/features/community/server/context-publication-history-screen.tsx",
    "copy.unavailableHint",
  ],
  ["site/src/features/discovery/server/discovery-directory.tsx", "copy.unavailableHint"],
  ["site/src/app/workspace/saved/page.tsx", "copy.pageErrorHint"],
  ["site/src/features/support/components/support-case-thread.tsx", "copy.caseLoadErrorHint"],
  ["site/src/features/support/components/support-center.tsx", "copy.loadErrorHint"],
  ["site/src/features/accounts/components/settings-page-client.tsx", "copy.loadFailedHint"],
  [
    "site/src/features/accounts/components/settings-active-sessions.tsx",
    "copy.sessionUnavailableHint",
  ],
  ["site/src/features/accounts/components/profile-privacy-editor.tsx", "copy.reloadHint"],
  ["site/src/features/organizations/components/organization-workspace.tsx", "copy.unavailableHint"],
  ["site/src/features/notifications/components/web-push-settings.tsx", "copy.webPushErrorHint"],
  [
    "site/src/features/organizations/components/organization-team-directory.tsx",
    "copy.uncertainHint",
  ],
  ["site/src/app/acquire/page.tsx", "copy.claimErrorHint"],
];

it("locks history/discovery/saved/support/settings load ErrorStates to recovery hints", () => {
  for (const [path, hint] of pages) {
    expect(read(path), path).toContain(`description={${hint}}`);
  }
  expect(read("site/src/features/servers/server-workspace-copy.ts")).toContain(
    "historyUnavailableHint:",
  );
  expect(read("site/src/features/servers/server-publication-history-copy.ts")).toContain(
    "unavailableHint:",
  );
  expect(
    read("site/src/features/organizations/organization-publication-history-copy.ts"),
  ).toContain("unavailableHint:");
  expect(read("site/src/features/discovery/discovery-copy.ts")).toContain("unavailableHint:");
  expect(read("site/src/features/community/follow-workspace-copy.ts")).toContain("pageErrorHint:");
  expect(read("site/src/lib/i18n/en/community.ts")).toContain("caseLoadErrorHint:");
  expect(read("site/src/lib/i18n/ru/community.ts")).toContain("caseLoadErrorHint:");
  expect(read("site/src/lib/i18n/en/community.ts")).toContain("loadErrorHint:");
  expect(read("site/src/lib/i18n/ru/community.ts")).toContain("loadErrorHint:");
  expect(read("site/src/lib/i18n/en/admin.ts")).toContain("loadFailedHint:");
  expect(read("site/src/lib/i18n/ru/admin.ts")).toContain("loadFailedHint:");
  expect(read("site/src/lib/i18n/en/admin.ts")).toContain("sessionUnavailableHint:");
  expect(read("site/src/lib/i18n/ru/admin.ts")).toContain("sessionUnavailableHint:");
  expect(read("site/src/features/accounts/profile-privacy-copy.ts")).toContain("reloadHint:");
  expect(read("site/src/features/organizations/organization-workspace-copy.ts")).toContain(
    "unavailableHint:",
  );
  expect(read("site/src/lib/i18n/en/admin.ts")).toContain("webPushErrorHint:");
  expect(read("site/src/lib/i18n/ru/admin.ts")).toContain("webPushErrorHint:");
  expect(read("site/src/features/organizations/organization-team-copy.ts")).toContain(
    "uncertainHint:",
  );
  expect(read("site/src/lib/i18n/en/product.ts")).toContain("claimErrorHint:");
  expect(read("site/src/lib/i18n/ru/product.ts")).toContain("claimErrorHint:");
});
