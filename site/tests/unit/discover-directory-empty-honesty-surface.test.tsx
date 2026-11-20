import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/discovery/server/discovery-directory.tsx"),
  "utf8",
);

/** Honesty lock: discover load failure → ErrorState; empty items → EmptyState. */
it("locks discover directory empty≠fail and session-failed follow seeds", () => {
  expect(source).toContain("ErrorState");
  expect(source).toContain("EmptyState");
  expect(source).toContain("copy.unavailable");
  expect(source).toContain("copy.empty");
  expect(source).toMatch(/if \(!result\)\s*return\s*\(\s*<ErrorState[\s\S]*?title=\{loadError\}/u);
  expect(source).toMatch(
    /!result\.items\.length \? \([\s\S]*?<EmptyState[\s\S]*?title=\{copy\.empty\}/u,
  );
  expect(source).toContain(".catch(() => ({ user: null, failed: true }))");
  expect(source).toContain("if (viewer.failed) return { actor, saved: null, mutes: null }");
});
