import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for license serverUnavailable and binding changed ErrorState. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "apps/web/src/components/license-detail-view.tsx";

it("locks license server unavailable and binding changed notices to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="license-server-unavailable"');
  expect(source).toContain('id="license-binding-changed"');
  expect(source).toMatch(
    /<ErrorState id="license-server-unavailable" title=\{copy\.serverUnavailable\}/,
  );
  expect(source).toMatch(/<ErrorState id="license-binding-changed" title=\{copy\.changed\}/);
  expect(source).not.toContain("? (license.serverName ?? copy.serverUnavailable)");
  expect(source).not.toContain("? copy.available : copy.changed");
});
