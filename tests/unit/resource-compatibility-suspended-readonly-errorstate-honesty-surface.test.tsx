import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock: suspended soft secondary readonly → ErrorState. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "apps/web/src/components/resource-compatibility-form.tsx"),
  "utf8",
);

it("locks resource compatibility suspended readonly notice to ErrorState without soft secondary caption", () => {
  expect(source).toContain('import { Button, ErrorState, Input } from "@nexus/ui"');
  expect(source).toContain('id="resource-compatibility-suspended-readonly"');
  expect(source).toContain(
    '<ErrorState\n          id="resource-compatibility-suspended-readonly"\n          title={getResourcePublisherCopy(locale).readonly}\n        />',
  );
  expect(source).not.toMatch(
    /product\.suspended\s*\?\s*getResourcePublisherCopy\(locale\)\.readonly\s*:\s*getResourcePublisherCopy\(locale\)\.editNote/u,
  );
  expect(source).not.toMatch(/id="resource-compatibility-suspended-readonly"[^>]*action=/u);
});
