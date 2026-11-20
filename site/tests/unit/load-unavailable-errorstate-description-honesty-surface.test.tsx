import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surfaces = [
  {
    path: "site/src/features/commerce/server/license-history-page.tsx",
    description: "copy.loadUnavailableHint",
  },
  {
    path: "site/src/features/library/server/library-collections-list-view.tsx",
    description: "c.loadUnavailableDescription",
  },
  {
    path: "site/src/features/organizations/server/public-profile.tsx",
    description: "copy.loadUnavailableHint",
  },
  {
    path: "site/src/features/resources/server/market-page.tsx",
    description: "dictionary.market.loadUnavailableHint",
  },
  {
    path: "site/src/features/resources/server/versions-page.tsx",
    description: "copy.loadUnavailableHint",
  },
  {
    path: "site/src/features/community/server/moderated-discussion-screen.tsx",
    description: "copy.loadUnavailableHint",
  },
] as const;

it("locks loadUnavailable ErrorState recovery markers to description hints", () => {
  for (const surface of surfaces) {
    const source = read(surface.path);
    expect(source, surface.path).toContain("ErrorState");
    expect(source, surface.path).toContain(`description={${surface.description}}`);
  }
});

it("locks public versions session probe failure away from catalog loadUnavailable copy", () => {
  const source = read("site/src/features/resources/server/versions-page.tsx");
  expect(source).toContain('id="resource-versions-session-unavailable"');
  expect(source).toContain("copy.sessionUnavailable");
  expect(source).toContain("copy.sessionUnavailableDescription");
  expect(source).not.toMatch(/sessionFailed \?\s*\([\s\S]*?title=\{copy\.loadUnavailable\}/u);
});
