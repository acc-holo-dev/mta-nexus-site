import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/resource-lifecycle-controls.tsx"),
  "utf8",
);

it("locks lifecycle blocked notice to ErrorState with stable id", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="resource-lifecycle-blocked"');
  expect(source).toContain("title={copy.blocked}");
  expect(source).toMatch(
    /actions\.length === 0 \? \(\s*<ErrorState[\s\S]*?id="resource-lifecycle-blocked"[\s\S]*?title=\{copy\.blocked\}/u,
  );
  expect(source).not.toContain("<ErrorState\n          title={copy.blocked}");
  expect(source).not.toContain('className="text-sm text-warning">{copy.blocked}</p>');
});
