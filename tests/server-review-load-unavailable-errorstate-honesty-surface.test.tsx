import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/server-review-panel.tsx"), "utf8");

it("locks server review load unavailable notice to ErrorState with stable id", () => {
  expect(source).toContain(
    'import { Button, EmptyState, ErrorState, fieldClassBlock } from "@nexus/ui"',
  );
  expect(source).toContain('id="server-review-load-unavailable"');
  expect(source).toContain("title={loadCopy.unavailable}");
  expect(source).toMatch(
    /unavailable \|\| !page \? \(\s*<ErrorState[\s\S]*?id="server-review-load-unavailable"[\s\S]*?title=\{loadCopy\.unavailable\}/u,
  );
  expect(source).not.toContain("<ErrorState\n          title={loadCopy.unavailable}");
});
