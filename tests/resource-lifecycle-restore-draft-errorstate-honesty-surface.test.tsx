import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "site/src/components/resource-lifecycle-controls.tsx"),
  "utf8",
);

it("locks lifecycle restore-returns-draft notice to ErrorState without soft text-warning", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="resource-lifecycle-restore-draft"');
  expect(source).toMatch(
    /action === "restore" \? \(\s*<ErrorState\s+id="resource-lifecycle-restore-draft"/u,
  );
  expect(source).not.toContain('className="mt-1 block text-warning"');
  expect(source).not.toContain(
    "Restore returns a draft. It does not republish the resource.</span>",
  );
});
