import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for resource build load-unavailable notice. */
it("locks resource build load unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "resource-build-screen.tsx"), "utf8");
  expect(source).toContain('id="resource-build-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="resource-build-load-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.loadUnavailable}</p>');
});
