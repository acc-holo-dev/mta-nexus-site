import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/server-review-panel.tsx"), "utf8");

it("locks server-review eligibility notices to ErrorState and keeps success as status", () => {
  expect(source).toContain(
    'import { Button, EmptyState, ErrorState, fieldClassBlock } from "@nexus/ui"',
  );
  expect(source).toContain('id="server-review-eligibility-follow-required"');
  expect(source).toContain('id="server-review-eligibility-owner-conflict"');
  expect(source).toContain('id="server-review-eligibility-moderated"');
  expect(source).toMatch(
    /eligibility === "follow_required"[\s\S]*?<ErrorState[\s\S]*?title=\{copy\.followRequired\}/u,
  );
  expect(source).toMatch(
    /eligibility === "owner_conflict"[\s\S]*?<ErrorState[\s\S]*?title=\{copy\.ownerConflict\}/u,
  );
  expect(source).toMatch(
    /eligibility === "moderated"[\s\S]*?<ErrorState[\s\S]*?title=\{copy\.moderated\}/u,
  );
  expect(source).not.toContain(
    '<p className="text-xs text-warning">{copy.followRequired}</p>',
  );
  expect(source).not.toContain(
    '<p className="text-xs text-warning">{copy.ownerConflict}</p>',
  );
  expect(source).not.toContain('<p className="text-xs text-warning">{copy.moderated}</p>');
  expect(source).toContain('id="server-review-write-error"');
  expect(source).toContain('role="status"');
  expect(source).toMatch(/notice && !notice\.error \? \(\s*<p[\s\S]*?role="status"/u);
  expect(source).toContain("copy.saved");
});
