import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(process.cwd(), "apps/web/src/components");

/** Honesty lock for build package load-unavailable notice. */
it("locks build package load unavailable to ErrorState", () => {
  const source = readFileSync(join(root, "build-package-screen.tsx"), "utf8");
  expect(source).toContain('id="build-package-load-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="build-package-load-unavailable"\s+title=\{copy\.loadUnavailable\}/u,
  );
  expect(source).not.toContain('className="text-danger">{copy.loadUnavailable}</p>');
});
