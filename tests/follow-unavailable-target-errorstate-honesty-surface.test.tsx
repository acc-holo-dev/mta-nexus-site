import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "site/src/components/follow-workspace.tsx"), "utf8");

/** Honesty lock for follow items whose target href is unavailable. */
it("locks follow unavailable target notice to ErrorState", () => {
  expect(source).toContain('id="follow-unavailable-target"');
  expect(source).toMatch(
    /item\.href \? \([\s\S]*?\) : \(\s*<ErrorState id="follow-unavailable-target" title=\{copy\.unavailableTarget\} \/>\s*\)/u,
  );
  expect(source).not.toContain("<span>{copy.unavailableTarget}</span>");
});
