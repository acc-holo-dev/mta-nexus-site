import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "apps/web/src/components/support-status-history.tsx"), "utf8");

it("marks the loading line as status inside the live region", () => {
  expect(source).toContain('aria-live="polite"');
  expect(source).toMatch(
    /<p role="status" className="text-sm text-muted">\s*\{dictionary\.support\.historyLoading\}/u,
  );
});

it("locks ErrorState read failures, EmptyState empties, min-h-11 CTAs, and clip shells", () => {
  expect(source).toContain("ErrorState");
  expect(source).toContain("EmptyState");
  expect(source).toContain("historyEmptyHint");
  expect(source).toContain("historyUnavailableDescription");
  expect(source).toContain("overflow-x-clip");
  expect(source).toContain("min-w-0");
  expect(source).toContain("min-h-11");
  expect(source).not.toContain("min-h-9");
  expect(source).toContain("copy.historyEmpty");
  expect(source).toContain("copy.reload");
});
