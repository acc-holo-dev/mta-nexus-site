import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for resource QA soft write ErrorState (stable id + alert role via ErrorState). */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "apps/web/src/components/resource-qa-panel.tsx";

it("locks resource QA writeError to ErrorState with stable id", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="resource-qa-write-failed"');
  expect(source).toMatch(
    /\{writeError \? <ErrorState id="resource-qa-write-failed" title=\{writeError\} \/> : null\}/,
  );
  expect(source).not.toContain("{writeError ? <ErrorState title={writeError} /> : null}");
});
