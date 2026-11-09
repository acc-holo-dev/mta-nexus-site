import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock: own-discussion soft muted readonly → ErrorState alert. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "apps/web/src/components/own-discussion-detail.tsx";

it("locks own-discussion readonly notice to ErrorState without soft muted caption", () => {
  const source = read(surface);
  expect(source).toContain('import { ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="own-discussion-readonly"');
  expect(source).toMatch(
    /\{!comment\.editable && <ErrorState id="own-discussion-readonly" title=\{copy\.readOnly\} \/>\}/u,
  );
  expect(source).not.toContain('className="text-sm text-muted">{copy.readOnly}</p>');
});
