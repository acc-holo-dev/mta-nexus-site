import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for resource version help missing author content ErrorState. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "apps/web/src/components/resource-version-help-section.tsx";

it("locks version help missing author content notice to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="resource-version-help-missing"');
  expect(source).toMatch(
    /<ErrorState id="resource-version-help-missing" title=\{copy\.missingBody\}/,
  );
  expect(source).not.toContain('className="text-sm text-secondary">{copy.missingBody}</p>');
});
