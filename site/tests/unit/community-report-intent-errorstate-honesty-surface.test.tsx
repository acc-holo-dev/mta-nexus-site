import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/community/components/community-report-form.tsx"),
  "utf8",
);

it("routes unconfirmed community-report intent through ErrorState and keeps success as status", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain("<ErrorState");
  expect(source).toContain("title={error}");
  expect(source).toMatch(
    /intent \? \(\s*<ErrorState\s+title=\{message\([\s\S]*?The original submission is not confirmed[\s\S]*?\)\}\s*\/>/u,
  );
  expect(source).toContain('role="status"');
  expect(source).toContain("result.created ? copy.saved : copy.duplicate");
  expect(source).not.toMatch(
    /\{intent \? \(\s*<p role="status">[\s\S]*?The original submission is not confirmed[\s\S]*?<\/p>\s*\) : null\}/u,
  );
  expect(source).not.toContain('role="alert"');
});
