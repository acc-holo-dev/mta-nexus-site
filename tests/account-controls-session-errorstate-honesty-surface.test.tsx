import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for account-controls session check ErrorState (stable id + errorHint). */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "apps/web/src/components/account-controls.tsx";

it("locks account-controls session check failure to ErrorState with stable id", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="account-controls-session-error"');
  expect(source).toMatch(
    /<ErrorState\s+id="account-controls-session-error"\s+title=\{error\}\s+description=\{copy\.errorHint\}/u,
  );
  expect(source).not.toContain(
    '<ErrorState title={error} description={copy.errorHint} className="items-stretch py-4" />',
  );
});
