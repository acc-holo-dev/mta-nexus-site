import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks residual load-failure ErrorStates to recovery description hints", () => {
  const ownDiscussion = read("site/src/features/community/server/own-discussion-page.tsx");
  expect(ownDiscussion).toContain("title={copy.failed}");
  expect(ownDiscussion).toContain("description={copy.loadUnavailableHint}");

  const statistics = read("site/src/features/servers/server/server-statistics-page.tsx");
  expect(statistics).toContain(
    "description={title === copy.unavailable ? copy.unavailableHint : undefined}",
  );

  const support = read("site/src/features/support/server/support-message-page.tsx");
  expect(support).toContain(
    "title === supportWorkspaceCopy(locale).unavailable ? copy.unavailableHint : undefined",
  );
  expect(read("site/src/features/support/support-message-discovery-copy.ts")).toContain(
    "unavailableHint:",
  );

  const inventory = read("site/src/features/library/server/collection-inventory-page.tsx");
  expect(inventory).toContain("title === c.retry");
  expect(inventory).toContain("v.loadUnavailableDescription");
  expect(inventory).toContain("dictionary.errors.sessionRetryHint");
  expect(inventory).toContain("c.capacityErrorDescription");
  expect(inventory).toContain("dictionary.errors.formErrorHint");
  expect(inventory).toContain("c.actionErrorDescription");
  expect(inventory).not.toContain(
    "description={title === c.retry ? v.loadUnavailableDescription : undefined}",
  );

  const membership = read("site/src/features/library/server/library-membership-history-screen.tsx");
  expect(membership).toContain("m.loadUnavailableDescription");
  expect(membership).toContain(
    "description={title === c.retry ? m.loadUnavailableDescription : undefined}",
  );

  const resourceCollections = read(
    "site/src/features/library/server/resource-collections-page.tsx",
  );
  expect(resourceCollections).toContain("description={c.loadUnavailableDescription}");
  expect(resourceCollections).toContain("title === c.retry");
  expect(resourceCollections).toContain("c.loadUnavailableDescription");
  expect(resourceCollections).toContain("dictionary.errors.sessionRetryHint");
  expect(resourceCollections).toContain("c.capacityErrorDescription");
  expect(resourceCollections).toContain("c.actionErrorDescription");
  expect(resourceCollections).not.toContain(
    "description={title === c.retry ? c.loadUnavailableDescription : undefined}",
  );

  const observations = read("site/src/features/servers/server/server-observation-browser-page.tsx");
  expect(observations).toContain("text === copy.unavailable || text === stats.unavailable");
  expect(observations).toContain("copy.unavailableHint");
  expect(read("site/src/features/servers/server-observation-browser-copy.ts")).toContain(
    "unavailableHint:",
  );

  const moderation = read("site/src/features/community/server/community-moderation-screen.tsx");
  expect(moderation).toContain("copy.unavailableHint");
  expect(moderation).toContain("errors.sessionRetryHint");
  expect(moderation).toContain("copy.deniedHint");
  expect(read("site/src/features/community/community-moderation-copy.ts")).toContain(
    "unavailableHint:",
  );
});
