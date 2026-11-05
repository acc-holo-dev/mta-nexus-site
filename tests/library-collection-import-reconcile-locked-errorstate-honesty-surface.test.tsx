import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const importSource = read("apps/web/src/app/workspace/library/collections/[id]/import/page.tsx");
const reconcileSource = read(
  "apps/web/src/app/workspace/library/collections/[id]/reconcile/page.tsx",
);

/** Honesty lock: import/reconcile max-revision muted notes → ErrorState. */
it("locks collection import revisionLocked to ErrorState", () => {
  expect(importSource).toContain('import { ErrorState } from "@nexus/ui"');
  expect(importSource).toContain('id="library-collection-import-revision-locked"');
  expect(importSource).toContain(
    '<ErrorState id="library-collection-import-revision-locked" title={c.revisionLocked} />',
  );
  expect(importSource).not.toContain(
    "{collection.revision >= 2147483647 && <p>{c.revisionLocked}</p>}",
  );
  expect(importSource).not.toMatch(/id="library-collection-import-revision-locked"[^>]*action=/u);
});

it("locks collection reconcile revisionLocked to ErrorState", () => {
  expect(reconcileSource).toContain('import { ErrorState } from "@nexus/ui"');
  expect(reconcileSource).toContain('id="library-collection-reconcile-revision-locked"');
  expect(reconcileSource).toContain(
    '<ErrorState id="library-collection-reconcile-revision-locked" title={c.revisionLocked} />',
  );
  expect(reconcileSource).not.toContain(
    "{collection.revision >= 2147483647 && <p>{c.revisionLocked}</p>}",
  );
  expect(reconcileSource).not.toMatch(
    /id="library-collection-reconcile-revision-locked"[^>]*action=/u,
  );
});
