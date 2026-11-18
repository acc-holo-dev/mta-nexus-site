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
  expect(inventory).toContain(
    "description={title === c.retry ? v.loadUnavailableDescription : undefined}",
  );

  const membership = read("site/src/features/library/server/library-membership-history-screen.tsx");
  expect(membership).toContain(
    "description={title === c.retry ? m.loadUnavailableDescription : undefined}",
  );

  const resourceCollections = read(
    "site/src/features/library/server/resource-collections-page.tsx",
  );
  expect(resourceCollections).toContain(
    "description={title === c.retry ? c.loadUnavailableDescription : undefined}",
  );
  expect(resourceCollections).toContain("description={c.loadUnavailableDescription}");
});
