import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "site/src/components/author-resource-forms.tsx"), "utf8");

/** Honesty lock: new-version uploadBlocked PRODUCT_STATE_CHANGED → ErrorState. */
it("locks author resource uploadBlocked product-state change to ErrorState", () => {
  expect(source).toContain('import { Button, ErrorState, Input } from "@nexus/ui"');
  expect(source).toContain('id="author-resource-upload-blocked"');
  expect(source).toContain("getResourceCommerceCopy(locale).errors.PRODUCT_STATE_CHANGED");
  expect(source).toContain("getResourcePublisherCopy(locale).readonly");
  expect(source).not.toMatch(
    /uploadBlocked\s*\?\s*getResourceCommerceCopy\(locale\)\.errors\.PRODUCT_STATE_CHANGED\s*:\s*publishing\.submittedDescription/u,
  );
  expect(source).not.toMatch(/id="author-resource-upload-blocked"[^>]*action=/u);
});
