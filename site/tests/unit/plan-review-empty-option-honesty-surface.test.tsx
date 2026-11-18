import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/** Wave 59: plan-review empty organization option uses unknownMarker, not a raw dash. */
it("locks plan-review empty option to unknownMarker", () => {
  const source = read("site/src/features/commerce/components/plan-review-form.tsx");
  expect(source).toContain('from "../../../lib/i18n/unknown"');
  expect(source).toContain("unknownMarker(locale)");
  expect(source).not.toContain('<option value="">—</option>');
});
