import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/resources/components/resource-release-watch-batch-controls.tsx"),
  "utf8",
);

/** Honesty lock: watch-limit maximum role=note → ErrorState. */
it("locks resource release watch batch maximum to ErrorState", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="resource-release-watch-batch-maximum"');
  expect(source).toContain("description={copy.batchMaximumHint}");
  expect(source).not.toContain('{enabling && capacity === 0 && <p role="note">{copy.maximum}</p>}');
  expect(source).not.toMatch(/id="resource-release-watch-batch-maximum"[^>]*action=/u);
});

it("locks resource release watch batch pending and skipped recovery to ErrorState", () => {
  expect(source).toContain('id="resource-release-watch-batch-pending"');
  expect(source).toContain('id="resource-release-watch-batch-skipped"');
  expect(source).toContain("title={copy.pendingNote}");
  expect(source).toContain("title={copy.skippedNote}");
  expect(source).toContain("description={copy.failedDescription}");
  expect(source).not.toContain('<p className="text-sm text-muted">{copy.pendingNote}</p>');
  expect(source).not.toContain('<p className="text-sm text-muted">{copy.skippedNote}</p>');
  expect(source).not.toContain('role="note"');
});
