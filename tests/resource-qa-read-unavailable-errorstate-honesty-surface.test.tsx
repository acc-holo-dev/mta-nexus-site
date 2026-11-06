import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/resource-qa-panel.tsx"), "utf8");

it("locks resource Q&A read unavailable notice to ErrorState with stable id", () => {
  expect(source).toContain('import { Button, EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="resource-qa-read-unavailable"');
  expect(source).toContain("title={readError}");
  expect(source).toMatch(
    /readError \? \(\s*<ErrorState[\s\S]*?id="resource-qa-read-unavailable"[\s\S]*?title=\{readError\}/u,
  );
  expect(source).not.toContain("<ErrorState\n          title={readError}");
});
