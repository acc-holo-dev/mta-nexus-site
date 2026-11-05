import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/app/servers/[slug]/page.tsx"), "utf8");

it("locks server directory staleSnapshot notice to ErrorState without soft text-warning", () => {
  expect(source).toContain('import { ErrorState, TrustBadge } from "@nexus/ui"');
  expect(source).toContain('id="server-directory-stale-snapshot"');
  expect(source).toMatch(
    /directoryIsStale \? \(\s*<ErrorState\s+id="server-directory-stale-snapshot"\s+title=\{copy\.staleSnapshot\}\s*\/>\s*\) : null/u,
  );
  expect(source).not.toContain('className="text-[11px] text-warning">{copy.staleSnapshot}</div>');
  expect(source).not.toContain('className="text-[11px] text-warning"');
});
