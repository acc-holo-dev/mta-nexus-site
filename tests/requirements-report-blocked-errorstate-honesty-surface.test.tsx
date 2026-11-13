import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for requirements report blocked/review/cycle ErrorState. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "site/src/components/resource-requirements-report-body.tsx";

it("locks requirements report blocked, review, and cycle notices to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain("resource-requirements-report-blocked");
  expect(source).toContain("resource-requirements-report-review");
  expect(source).toContain("resource-requirements-cycle-");
  expect(source).toMatch(/title=\{copy\.states\[report\.state\]\}/);
  expect(source).not.toContain('className="break-words text-danger"');
});
