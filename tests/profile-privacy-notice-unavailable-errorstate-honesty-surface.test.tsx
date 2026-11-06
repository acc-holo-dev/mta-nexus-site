import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/profile-privacy-editor.tsx"),
  "utf8",
);

/** Honesty lock for profile privacy editor notice failure. */
it("locks profile-privacy-notice-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="profile-privacy-notice-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="profile-privacy-notice-unavailable"[\s\S]*?title=\{notice\.text\}/u,
  );
});
