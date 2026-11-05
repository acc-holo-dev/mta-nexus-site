import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for server clipboard unavailable ErrorState. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surfaces = [
  "apps/web/src/components/server-connect-controls.tsx",
  "apps/web/src/components/server-card.tsx",
] as const;

it.each(surfaces)("locks copyUnavailable notice to ErrorState in %s", (relative) => {
  const source = read(relative);
  expect(source).toContain("ErrorState");
  expect(source).toContain("copy-unavailable");
  expect(source).toMatch(/title=\{copy\.copyUnavailable\}/);
  expect(source).toMatch(/copyMessage === copy\.copyUnavailable/);
});
