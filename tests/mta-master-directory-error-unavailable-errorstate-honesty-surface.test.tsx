import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/mta-master-server-directory.tsx"),
  "utf8",
);

/** Honesty lock for mta master directory runtime error. */
it("locks mta-master-directory-error-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="mta-master-directory-error-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="mta-master-directory-error-unavailable"[\s\S]*?title=/u,
  );
});
