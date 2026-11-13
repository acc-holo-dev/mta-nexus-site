import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "site/src/components/library-membership-batch.tsx"), "utf8");

/** Honesty lock: capacity/access cannotAdd muted note → ErrorState. */
it("locks library membership cannotAdd blocker to ErrorState", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="library-membership-cannot-add"');
  expect(source).toContain('<ErrorState id="library-membership-cannot-add" title={h.cannotAdd} />');
  expect(source).not.toContain(
    '{cannotAdd && <p className="text-xs text-muted">{h.cannotAdd}</p>}',
  );
  expect(source).not.toMatch(/<ErrorState id="library-membership-cannot-add"[^>]*action=/u);
});
