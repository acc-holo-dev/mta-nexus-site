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
    title: "copy.noHistory",
    description: "copy.noHistoryHint",
    soft: /<p className="text-secondary">\{copy\.noHistory\}<\/p>/u,
  },
  {
    path: "site/src/features/library/components/library-collection-reconcile.tsx",
    title: "m.noChanges",
    description: "m.noChangesHint",
    soft: /return <p>\{m\.noChanges\}<\/p>/u,
  },
  {
    path: "site/src/features/resources/server/build-package-screen.tsx",
    title: "copy.noFiles",
    description: "copy.noFilesHint",
    soft: /<p className="text-muted">\{copy\.noFiles\}<\/p>/u,
  },
] as const;

it("locks confirmed empty results to EmptyState with honesty hints", () => {
  for (const surface of surfaces) {
    const source = read(surface.path);
    expect(source, surface.path).toContain("EmptyState");
    expect(source, surface.path).toContain(surface.title);
    expect(source, surface.path).toContain(surface.description);
    expect(source, surface.path).not.toMatch(surface.soft);
  }
  expect(read("site/src/features/library/library-collection-manifests-i18n.ts")).toContain(
    "noChangesHint:",
  );
  expect(read("site/src/features/resources/build-package-i18n.ts")).toContain("noFilesHint:");
});
