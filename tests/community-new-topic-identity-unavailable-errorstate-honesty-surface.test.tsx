import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/app/community/new/page.tsx"), "utf8");

/** Honesty lock for community new topic identity error. */
it("locks community-new-topic-identity-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="community-new-topic-identity-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="community-new-topic-identity-unavailable"\s+title=\{copy\.topicIdentityError\}/u,
  );
});
