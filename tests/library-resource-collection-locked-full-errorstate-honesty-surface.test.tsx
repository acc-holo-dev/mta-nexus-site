import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "site/src/app/workspace/library/[id]/collections/page.tsx"),
  "utf8",
);

/** Honesty lock: per-row revisionLocked / fullCollection muted notes → ErrorState. */
it("locks library resource collection revisionLocked and fullCollection to ErrorState", () => {
  expect(source).toContain('import { EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="library-resource-collection-revision-locked"');
  expect(source).toContain('id="library-resource-collection-full"');
  expect(source).toContain("title={c.revisionLocked}");
  expect(source).toContain("title={c.fullCollection}");
  expect(source).toContain("{c.archivedNote}");
  expect(source).not.toContain('<p className="text-sm text-muted">{c.revisionLocked}</p>');
  expect(source).not.toContain('<p className="text-sm text-muted">{c.fullCollection}</p>');
  expect(source).not.toMatch(/id="library-resource-collection-revision-locked"[^>]*action=/u);
  expect(source).not.toMatch(/id="library-resource-collection-full"[^>]*action=/u);
});
