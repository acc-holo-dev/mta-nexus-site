import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/resources/components/resource-download-button.tsx"),
  "utf8",
);

it("locks fixed-selection unavailableReason to ErrorState and keeps success as status", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toMatch(
    /if \(unavailableReason\) \{\s*return \(\s*<div className="space-y-2">\s*<ErrorState title=\{unavailableReason\} \/>/u,
  );
  expect(source).toContain("<ErrorState\n          title={copy.downloadErrors[failure]}");
  expect(source).toContain('role="status"');
  expect(source).toContain("copy.downloadHandedOff");
  expect(source).not.toContain('role="status" className="text-sm text-warning"');
  expect(source).not.toContain('className="text-sm text-warning"');
});
