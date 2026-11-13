import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock: collection history muted noCurrent → ErrorState. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/app/workspace/library/collections/history/page.tsx"),
  "utf8",
);

it("locks collection history current-unavailable notice to ErrorState without soft muted caption", () => {
  expect(source).toContain('import { Button, EmptyState, ErrorState, Input } from "@nexus/ui"');
  expect(source).toContain('id="library-collection-history-current-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="library-collection-history-current-unavailable"\s+title=\{h\.noCurrent\}\s*\/>/u,
  );
  expect(source).not.toContain('className="text-muted">{h.noCurrent}</p>');
});
