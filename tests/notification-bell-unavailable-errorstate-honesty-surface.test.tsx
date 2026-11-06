import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/notification-bell.tsx"), "utf8");

/** Honesty lock for notification bell failure. */
it("locks notification-bell-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="notification-bell-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="notification-bell-unavailable"\s+title=\{error\}/u);
});
