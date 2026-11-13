import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for MTA meta-inspector HTTP/structural issue ErrorState. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "site/src/components/mta-meta-inspector-panel.tsx";

it("locks meta-inspector http export and structural issue notices to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="mta-meta-inspector-http-exports"');
  expect(source).toContain("mta-meta-inspector-issue-");
  expect(source).not.toContain('className="text-[10px] text-warning"');
  expect(source).not.toContain(
    'issue.severity === "error" ? "text-xs text-danger" : "text-xs text-warning"',
  );
});
