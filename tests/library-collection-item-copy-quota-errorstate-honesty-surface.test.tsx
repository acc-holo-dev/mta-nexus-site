import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/library-collection-item-copy.tsx"),
  "utf8",
);

/** Honesty lock: over-capacity copy notice must use stable ErrorState id. */
it("locks library collection copy quota notice to ErrorState", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="library-collection-item-copy-quota"');
  expect(source).toContain("title={c.quota}");
  expect(source).toContain("description={c.capacityErrorDescription}");
  expect(source).toMatch(
    /overCapacity \? \(\s*<ErrorState[\s\S]*?id="library-collection-item-copy-quota"[\s\S]*?title=\{c\.quota\}[\s\S]*?description=\{c\.capacityErrorDescription\}/u,
  );
  expect(source).not.toContain("<ErrorState title={c.quota}");
  expect(source).not.toContain('<p role="note">{c.quota}</p>');
});
