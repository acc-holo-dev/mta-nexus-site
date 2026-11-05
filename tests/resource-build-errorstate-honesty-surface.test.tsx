import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/resource-build-controls.tsx"),
  "utf8",
);

it("locks resource build uncertain failures to ErrorState with touch reload", () => {
  expect(source).toContain('import { Button, ErrorState, Input } from "@nexus/ui"');
  expect(source).toContain("<ErrorState title={message} />");
  expect(source).toContain('role="status"');
  expect(source).toMatch(
    /uncertain && \(\s*<Button[\s\S]*?className="min-h-11"[\s\S]*?\{copy\.reload\}/u,
  );
  expect(source).not.toContain('role={uncertain ? "alert" : "status"}');
  expect(source).not.toContain('role="alert"');
});

it("locks withdrawn product notice to ErrorState without fake retry", () => {
  expect(source).toContain('id="resource-build-withdrawn-unavailable"');
  expect(source).toMatch(
    /withdrawn \? \(\s*<ErrorState id="resource-build-withdrawn-unavailable" title=\{copy\.unavailable\} \/>\s*\) : null/u,
  );
  expect(source).not.toContain('className="text-warning">{copy.unavailable}</p>');
});
