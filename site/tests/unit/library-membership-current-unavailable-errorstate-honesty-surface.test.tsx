import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock: membership history muted noCurrent → ErrorState. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/library/server/library-membership-history-item.tsx"),
  "utf8",
);

it("locks membership history current-unavailable notice to ErrorState without soft caption", () => {
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="library-membership-history-current-unavailable"');
  expect(source).toContain("description={h.noCurrentHint}");
  expect(source).toMatch(
    /<ErrorState\s+id="library-membership-history-current-unavailable"\s+title=\{h\.noCurrent\}/u,
  );
  expect(source).not.toMatch(/return <p>\{h\.noCurrent\}<\/p>|<p>\{h\.noCurrent\}<\/p>/u);
});
