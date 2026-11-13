import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock: admin quarantined build reason soft danger caption → ErrorState. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "site/src/components/admin/admin-builds-quarantine-section.tsx"),
  "utf8",
);

it("locks admin build quarantine reason to ErrorState without soft text-danger caption", () => {
  expect(source).toContain(
    'import { EmptyState, ErrorState, SectionHeader, StatusBadge } from "@nexus/ui"',
  );
  expect(source).toContain('id="admin-build-quarantine-reason"');
  expect(source).toMatch(
    /<ErrorState\s+id="admin-build-quarantine-reason"\s+title=\{copy\.quarantineReason\}\s+description=\{build\.quarantineReason \?\? undefined\}\s*\/>/u,
  );
  expect(source).not.toContain('className="whitespace-pre-wrap font-caption text-danger"');
  expect(source).not.toContain("{copy.quarantineReason}: {build.quarantineReason}");
});
