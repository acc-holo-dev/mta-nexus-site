import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/resource-release-watch-control.tsx"),
  "utf8",
);

it("locks suppressed/disabled release-watch notices to ErrorState and keeps success as status", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain("{!commerceEnabled ? <ErrorState title={copy.suppressed} /> : null}");
  expect(source).toContain("{disabledReason ? <ErrorState title={disabledReason} /> : null}");
  expect(source).toContain('id="resource-release-watch-control-unavailable"');
  expect(source).toMatch(
    /\{error \? \(\s*<ErrorState\s+id="resource-release-watch-control-unavailable"\s+title=\{error\}\s+description=\{copy\.failedDescription\}\s*\/>\s*\) : null\}/u,
  );
  expect(source).toContain('role="status"');
  expect(source).toContain("{copy.saved}");
  expect(source).not.toContain('role="note" className="text-sm text-warning"');
  expect(source).not.toContain('className="text-sm text-warning"');
  expect(source).not.toContain('role="alert"');
});
