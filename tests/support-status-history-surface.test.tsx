import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const source = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../apps/web/src/components/support-status-history.tsx",
  ),
  "utf8",
);

it("marks the loading line as status inside the live region", () => {
  expect(source).toContain('aria-live="polite"');
  expect(source).toMatch(
    /<p role="status" className="text-sm text-muted">\s*\{dictionary\.support\.loading\}/u,
  );
});
