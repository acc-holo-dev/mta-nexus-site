import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for resource QA soft write ErrorState (stable id + alert role via ErrorState). */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "site/src/features/resources/components/resource-qa-panel.tsx";

it("locks resource QA writeError to ErrorState with stable id", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="resource-qa-write-failed"');
  expect(source).toMatch(
    /\{writeError \? \(\s*<ErrorState\s+id="resource-qa-write-failed"\s+title=\{writeError\}\s+description=\{getDictionary\(locale\)\.errors\.formErrorHint\}\s*\/>\s*\) : null\}/u,
  );
  expect(source).not.toContain("{writeError ? <ErrorState title={writeError} /> : null}");
});
