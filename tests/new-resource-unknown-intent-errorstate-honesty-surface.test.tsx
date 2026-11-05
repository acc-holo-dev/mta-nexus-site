import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/new-resource-form.tsx"), "utf8");

it("locks new-resource unknown intent notice to ErrorState and keeps hard error plus success status", () => {
  expect(source).toContain(
    'import { Button, ErrorState, fieldControlClass, Input } from "@nexus/ui"',
  );
  expect(source).toContain("The result may be unknown. To retry safely, select the same file;");
  expect(source).toMatch(
    /\{intent \? \(\s*<ErrorState\s+title=\{message\([\s\S]*?The result may be unknown[\s\S]*?\)\}\s*\/>\s*\) : null\}/u,
  );
  expect(source).toContain("<ErrorState");
  expect(source).toContain("title={error}");
  expect(source).toContain('role="status"');
  expect(source).toContain("copy.buildRetryReady");
  expect(source).not.toContain('<p role="status">');
  expect(source).not.toMatch(
    /\{intent && \(\s*<p role="status">[\s\S]*?The result may be unknown[\s\S]*?<\/p>\s*\)\}/u,
  );
  expect(source).not.toContain('role="alert"');
});
