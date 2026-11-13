import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "site/src/components/library-membership-batch.tsx"), "utf8");

/** Honesty lock: revisionLocked soft muted note → ErrorState; archived stays instructional. */
it("locks library membership revisionLocked to ErrorState", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="library-membership-revision-locked"');
  expect(source).toContain("title={c.revisionLocked}");
  expect(source).toContain("{c.archivedNote}");
  expect(source).toContain('<p role="note" className="text-xs text-muted">');
  expect(source).not.toContain(
    '{collection.status === "archived" ? c.archivedNote : c.revisionLocked}',
  );
  expect(source).not.toMatch(/id="library-membership-revision-locked"[^>]*action=/u);
});
