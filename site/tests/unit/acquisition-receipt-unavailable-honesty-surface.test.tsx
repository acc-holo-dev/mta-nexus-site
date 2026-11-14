import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/app/workspace/acquisitions/receipts/[id]/page.tsx"),
  "utf8",
);

it("locks non-downloadable receipt access notices to ErrorState", () => {
  expect(source).toContain('import { ErrorState } from "@nexus/ui"');
  expect(source).toContain(
    "<ErrorState title={item.hasCurrentAccess ? copy.unavailable : copy.removed} />",
  );
  expect(source).not.toContain('className="text-sm text-warning"');
  expect(source).not.toContain(
    "{item.hasCurrentAccess ? copy.unavailable : copy.removed}\n                </p>",
  );
});
