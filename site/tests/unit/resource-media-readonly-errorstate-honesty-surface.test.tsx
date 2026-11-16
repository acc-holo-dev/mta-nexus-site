import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/resources/components/resource-media-editor.tsx"),
  "utf8",
);

it("locks gallery readonly notice to ErrorState without soft text-warning", () => {
  expect(source).toContain('import { Button, EmptyState, ErrorState, Input } from "@nexus/ui"');
  expect(source).toContain('id="resource-media-readonly"');
  expect(source).toMatch(
    /readonly \? <ErrorState id="resource-media-readonly" title=\{copy\.readonly\} \/> : null/u,
  );
  expect(source).not.toContain('role="note" className="text-warning"');
  expect(source).not.toContain('className="text-warning">\n          {copy.readonly}');
});
