import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for server-details missing-revision unavailable notice. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "site/src/components/server-details-form.tsx";

it("locks missing saved revision to ErrorState alert", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="server-details-missing-revision"');
  expect(source).toMatch(
    /!lastSavedAt \? \(\s*<ErrorState id="server-details-missing-revision" title=\{copy\.missingRevision\} \/>\s*\) : null/u,
  );
  expect(source).not.toContain('className="text-sm text-muted">{copy.missingRevision}</p>');
});
