import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "apps/web/src/components/resource-release-watch-batch-controls.tsx"),
  "utf8",
);

/** Honesty lock: watch-limit maximum role=note → ErrorState. */
it("locks resource release watch batch maximum to ErrorState", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="resource-release-watch-batch-maximum"');
  expect(source).toContain(
    '<ErrorState id="resource-release-watch-batch-maximum" title={copy.maximum} />',
  );
  expect(source).not.toContain('{enabling && capacity === 0 && <p role="note">{copy.maximum}</p>}');
  expect(source).not.toMatch(/id="resource-release-watch-batch-maximum"[^>]*action=/u);
});
