import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/notification-inbox.tsx"), "utf8");

/** Honesty lock for notification inbox load failure. */
it("locks notification-inbox-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="notification-inbox-unavailable"');
  expect(source).toMatch(/<ErrorState\s+id="notification-inbox-unavailable"\s+title=\{error\}/u);
});
