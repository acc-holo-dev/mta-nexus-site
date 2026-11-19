import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/library/server/library-page-screen.tsx"),
  "utf8",
);

/** Honesty lock for library item unavailableReason notice. */
it("locks library unavailableReason to ErrorState", () => {
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="library-item-unavailable-reason"');
  expect(source).toContain("description={copy.unavailableReasonHint}");
  expect(source).toMatch(
    /<ErrorState\s+id="library-item-unavailable-reason"\s+title=\{copy\.unavailableReason\}/u,
  );
  const view = readFileSync(join(root, "site/src/features/library/library-view.ts"), "utf8");
  expect(view).toContain("unavailableReasonHint:");
  expect(source).not.toContain(
    'className="mt-auto text-sm text-muted">{copy.unavailableReason}</p>',
  );
});
