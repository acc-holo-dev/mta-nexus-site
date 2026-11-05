import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/server-claim-status-panel.tsx"),
  "utf8",
);

/** Honesty lock: outdated/mismatched claim proof → ErrorState with stable id. */
it("locks outdated claim proof notice to ErrorState with stable id", () => {
  expect(source).toContain('import { ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="server-claim-outdated"');
  expect(source).toContain('<ErrorState id="server-claim-outdated" title={copy.outdated} />');
  expect(source).toContain("!request.proofMatchesServer");
  expect(source).not.toContain(
    'className="text-xs leading-relaxed text-warning">{copy.outdated}</p>',
  );
  expect(source).not.toContain("text-warning");
  expect(source).not.toContain('role="alert"');
});
