import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LibraryCollectionsErrorPanel } from "../../apps/web/src/components/library-collections-error-panel";
import { libraryCollectionManifestsCopy } from "../../apps/web/src/lib/library-collection-manifests-i18n";
import { libraryCollectionsCopy } from "../../apps/web/src/lib/library-collections-i18n";
import { libraryMembershipBatchesCopy } from "../../apps/web/src/lib/library-membership-batches-i18n";
import { librarySelectionBatchesCopy } from "../../apps/web/src/lib/library-selection-batches-i18n";
import { getResourceReleaseControlCopy } from "../../apps/web/src/lib/resource-release-control-i18n";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const forms = [
  "apps/web/src/components/library-collection-batch.tsx",
  "apps/web/src/components/library-collection-command.tsx",
  "apps/web/src/components/library-collection-import.tsx",
  "apps/web/src/components/library-collection-item-copy.tsx",
  "apps/web/src/components/library-collection-reconcile.tsx",
  "apps/web/src/components/library-collections-error-panel.tsx",
  "apps/web/src/components/library-membership-batch.tsx",
  "apps/web/src/components/library-release-command.tsx",
  "apps/web/src/components/library-selection-batch-controls.tsx",
] as const;

it("locks library form sources to ErrorState honesty without plain alert paragraphs", () => {
  for (const form of forms) {
    const source = read(form);
    expect(source).toContain("ErrorState");
    expect(source).toMatch(/min-h-11|size="touch"/u);
    expect(source).not.toContain('role="alert"');
  }
});

it("keeps additive action-error copy for library form locales", () => {
  expect(libraryCollectionsCopy("en").actionErrorDescription.length).toBeGreaterThan(20);
  expect(libraryCollectionsCopy("ru").actionErrorDescription.length).toBeGreaterThan(20);
  expect(libraryCollectionsCopy("en").capacityErrorDescription.length).toBeGreaterThan(20);
  expect(libraryCollectionManifestsCopy("en").previewErrorDescription.length).toBeGreaterThan(20);
  expect(libraryMembershipBatchesCopy("en").actionErrorDescription.length).toBeGreaterThan(20);
  expect(librarySelectionBatchesCopy("en").actionErrorDescription.length).toBeGreaterThan(20);
  expect(getResourceReleaseControlCopy("en").errors.actionErrorDescription.length).toBeGreaterThan(
    20,
  );
  expect(read("apps/web/src/lib/library-collections-i18n.ts")).toContain("actionErrorDescription");
  expect(read("apps/web/src/lib/library-collection-manifests-i18n.ts")).toContain(
    "previewErrorDescription",
  );
  expect(read("apps/web/src/lib/library-membership-batches-i18n.ts")).toContain(
    "actionErrorDescription",
  );
  expect(read("apps/web/src/lib/library-selection-batches-i18n.ts")).toContain(
    "actionErrorDescription",
  );
  expect(read("apps/web/src/lib/resource-release-control-i18n.ts")).toContain(
    "actionErrorDescription",
  );
});

it("renders collections error panel with ErrorState description and touch recovery", () => {
  const copy = libraryCollectionsCopy("en");
  const html = renderToStaticMarkup(
    createElement(LibraryCollectionsErrorPanel, {
      locale: "en",
      code: "COLLECTION_CONFLICT",
    }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain("bg-danger-soft");
  expect(html).toContain(copy.conflict);
  expect(html).toContain(copy.actionErrorDescription);
  expect(html).toContain("min-h-11");
  expect(html).toContain("overflow-x-clip");
  expect(html).not.toContain('class="text-warning"');
});
