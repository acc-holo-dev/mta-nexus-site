import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for publication readiness blocked/pending ErrorState. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "apps/web/src/components/resource-publication-readiness-panel.tsx";

it("locks publication readiness blocked and pending notices to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain("publication-readiness-blocked-");
  expect(source).toContain("publication-readiness-pending-");
  expect(source).toMatch(/title=\{copy\.states\[item\.state\]\}/);
  expect(source).not.toMatch(
    /item\.state === "blocked" \|\| item\.state === "pending"[\s\S]*stateTone\[item\.state\][\s\S]*copy\.states\[item\.state\]/,
  );
});
