import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/app/workspace/servers/new/page.tsx"), "utf8");

/** Honesty lock for servers new session check failure. */
it("locks servers-new-session-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="servers-new-session-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="servers-new-session-unavailable"[\s\S]*?title=\{locale === "ru" \? "Не удалось проверить сессию" : "Could not check your session"\}/u,
  );
});
