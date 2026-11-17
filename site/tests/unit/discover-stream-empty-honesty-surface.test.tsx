import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const page = readFileSync(join(root, "site/src/app/discover/stream/page.tsx"), "utf8");
const directory = readFileSync(
  join(root, "site/src/features/discovery/server/discovery-directory.tsx"),
  "utf8",
);

/** Honesty lock: stream load failure → ErrorState; empty pages stay EmptyState in DirectoryResults. */
it("locks discover stream failures to ErrorState without empty-catalog lies", () => {
  expect(page).toContain("ErrorState");
  expect(page).toContain("discoveryStreamError");
  expect(page).toMatch(/error \? \([\s\S]*?<ErrorState[\s\S]*?title=\{error\}/u);
  expect(directory).toContain("copy.empty");
  expect(directory).toContain("copy.unavailable");
  expect(page).not.toContain("EmptyState");
});
