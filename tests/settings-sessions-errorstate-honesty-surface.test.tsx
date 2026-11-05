import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/settings-active-sessions.tsx"),
  "utf8",
);

it("routes unavailable sessions through ErrorState with reload and keeps empty EmptyState", () => {
  expect(source).toContain('import { Button, EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toMatch(
    /sessions === null \? \(\s*<ErrorState[\s\S]*?title=\{copy\.sessionUnavailable\}[\s\S]*?onClick=\{onReload\}[\s\S]*?\{copy\.reloadSettings\}/u,
  );
  expect(source).toContain(
    "<EmptyState title={copy.noSessions} description={copy.sessionsDescription} />",
  );
  expect(source).not.toContain('<p className="text-sm text-muted">{copy.sessionUnavailable}</p>');
  expect(source).toContain('size="touch"');
  expect(source).not.toContain('role="alert"');
});
