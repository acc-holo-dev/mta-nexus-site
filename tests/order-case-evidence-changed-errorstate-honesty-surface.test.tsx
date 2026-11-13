import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "site/src/components/order-case-page.tsx"), "utf8");

it("locks evidence-changed notice to ErrorState without soft text-warning", () => {
  expect(source).toContain('import { Button, EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="order-case-evidence-changed"');
  expect(source).toMatch(
    /evidenceChanged \? \(\s*<ErrorState id="order-case-evidence-changed" title=\{copy\.changed\} \/>\s*\) : null/u,
  );
  expect(source).not.toContain('role="note" className="text-sm text-warning"');
  expect(source).not.toContain('className="text-sm text-warning">\n          {copy.changed}');
});
