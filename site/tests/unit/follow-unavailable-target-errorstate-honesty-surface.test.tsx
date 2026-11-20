import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/community/components/follow-workspace.tsx"),
  "utf8",
);

/** Honesty lock for follow items whose target href is unavailable. */
it("locks follow unavailable target notice to ErrorState", () => {
  expect(source).toContain('id="follow-unavailable-target"');
  expect(source).toContain("title={copy.unavailableTarget}");
  expect(source).toContain("description={copy.unavailableTargetHint}");
  expect(source).toMatch(
    /item\.href \? \([\s\S]*?\) : \(\s*<ErrorState[\s\S]*?id="follow-unavailable-target"/u,
  );
  expect(source).not.toContain("<span>{copy.unavailableTarget}</span>");
});
