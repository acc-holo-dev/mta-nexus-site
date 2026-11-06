import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/commercial-plan-form.tsx"), "utf8");

/** Honesty lock for commercial plan form error notice. */
it("locks commercial-plan-form-error-unavailable notice to ErrorState", () => {
  expect(source).toContain('id="commercial-plan-form-error-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="commercial-plan-form-error-unavailable"[\s\S]*?title=/u,
  );
});
