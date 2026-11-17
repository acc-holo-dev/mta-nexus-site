import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/resources/components/new-resource-form.tsx"),
  "utf8",
);
const copy = readFileSync(join(root, "site/src/lib/i18n/en/publishing.ts"), "utf8");

it("locks new-resource unknown intent notice to ErrorState and keeps hard error plus success status", () => {
  expect(source).toContain(
    'import { Button, ErrorState, fieldControlClass, Input } from "@nexus/ui"',
  );
  expect(copy).toContain("resultMayBeUnknown:");
  expect(source).toContain("copy.resultMayBeUnknown");
  expect(source).toContain("copy.errorMayHaveCompleted");
  expect(source).toContain("copy.restoreFailed");
  expect(source).toContain("copy.recoverySaveFailed");
  expect(source).toMatch(
    /\{intent \? <ErrorState title=\{copy\.resultMayBeUnknown\} \/> : null\}/u,
  );
  expect(source).toContain("<ErrorState");
  expect(source).toContain("title={error}");
  expect(source).toContain('role="status"');
  expect(source).toContain("copy.buildRetryReady");
  expect(source).not.toContain("The result may be unknown. To retry safely, select the same file;");
  expect(source).not.toContain('<p role="status">');
  expect(source).not.toMatch(
    /\{intent && \(\s*<p role="status">[\s\S]*?The result may be unknown[\s\S]*?<\/p>\s*\)\}/u,
  );
  expect(source).not.toContain('role="alert"');
  expect(source).not.toContain("const message = (ru: string, en: string)");
});
