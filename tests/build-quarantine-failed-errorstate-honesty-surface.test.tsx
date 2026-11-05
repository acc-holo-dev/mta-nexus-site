import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for build quarantine soft failure ErrorState (stable id + alert role via ErrorState). */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/build-quarantine-controls.tsx"),
  "utf8",
);

it("locks build quarantine failure notice to ErrorState with stable id", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="build-quarantine-failed"');
  expect(source).toMatch(
    /\{error \? \(\s*<ErrorState\s+id="build-quarantine-failed"\s+title=\{error\}\s+description=\{copy\.quarantineBuildFailedDescription\}\s*\/>\s*\) : null\}/u,
  );
  expect(source).not.toContain(
    "<ErrorState title={error} description={copy.quarantineBuildFailedDescription} />",
  );
  expect(source).not.toMatch(/id="build-quarantine-failed"[^>]*action=/u);
  expect(source).not.toContain('role="alert"');
});
