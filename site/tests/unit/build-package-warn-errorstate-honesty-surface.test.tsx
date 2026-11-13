import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "site/src/components/build-package-screen.tsx"), "utf8");

it("locks legacy/no-baseline package notices to ErrorState without fake retry", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain(
    "{!detail.build.hasInventory ? <ErrorState title={copy.legacy} /> : null}",
  );
  expect(source).toContain("<ErrorState title={copy.noBaseline} />");
  expect(source).not.toContain('className="text-warning">{copy.legacy}</p>');
  expect(source).not.toContain('className="text-warning">{copy.noBaseline}</p>');
});
