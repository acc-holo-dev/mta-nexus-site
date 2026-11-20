import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");
const source = read("site/src/features/resources/server/acquisition-receipt-detail-screen.tsx");

it("locks non-downloadable receipt access notices to ErrorState", () => {
  expect(source).toContain('import { ErrorState } from "@nexus/ui"');
  expect(source).toContain("title={item.hasCurrentAccess ? copy.unavailable : copy.removed}");
  expect(source).toContain(
    "description={item.hasCurrentAccess ? copy.unavailableHint : copy.removedHint}",
  );
  expect(read("site/src/features/resources/resource-cart-receipts-i18n.ts")).toContain(
    "unavailableHint:",
  );
  expect(read("site/src/features/resources/resource-cart-receipts-i18n.ts")).toContain(
    "removedHint:",
  );
  expect(source).not.toContain('className="text-sm text-warning"');
  expect(source).not.toContain(
    "{item.hasCurrentAccess ? copy.unavailable : copy.removed}\n                </p>",
  );
});
