import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "site/src/app/workspace/resources/[id]/page.tsx"), "utf8");

/** Honesty lock: author resource build quarantine role=note → ErrorState. */
it("locks quarantined author resource build notice to ErrorState", () => {
  expect(source).toContain('import { EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="resource-build-quarantined"');
  expect(source).toMatch(
    /build\.status === "quarantined" && build\.quarantineReason && \(\s*<ErrorState\s+id="resource-build-quarantined"\s+title=\{copy\.quarantine\}\s+description=\{build\.quarantineReason\}\s*\/>\s*\)/u,
  );
  expect(source).not.toContain('role="note"');
  expect(source).not.toContain(
    'className="rounded-lg border border-[color:var(--nexus-danger)]/20 bg-danger-soft p-3 text-sm text-danger"',
  );
  expect(source).not.toMatch(/id="resource-build-quarantined"[^>]*action=/u);
});
