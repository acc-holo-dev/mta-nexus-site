import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock: details uploadBlocked soft secondary readonly → ErrorState. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "site/src/components/author-resource-forms.tsx"), "utf8");

it("locks author resource details readonly notice to ErrorState without soft secondary caption", () => {
  expect(source).toContain('import { Button, ErrorState, Input } from "@nexus/ui"');
  expect(source).toContain('id="author-resource-details-readonly"');
  expect(source).toContain(
    '<ErrorState\n            id="author-resource-details-readonly"\n            title={getResourcePublisherCopy(locale).readonly}\n          />',
  );
  expect(source).not.toMatch(
    /uploadBlocked\s*\?\s*getResourcePublisherCopy\(locale\)\.readonly\s*:\s*getResourcePublisherCopy\(locale\)\.editNote/u,
  );
  expect(source).not.toMatch(/id="author-resource-details-readonly"[^>]*action=/u);
});
