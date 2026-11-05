import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for gallery reviewNote ErrorState. */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/resource-media-screen.tsx"),
  "utf8",
);

it("locks gallery reviewNote notice to ErrorState without soft text-warning", () => {
  expect(source).toContain('import { ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="resource-media-review-note"');
  expect(source).toMatch(
    /<ErrorState id="resource-media-review-note" title=\{copy\.reviewNote\} \/>/u,
  );
  expect(source).not.toContain('role="note" className="text-sm text-warning"');
  expect(source).not.toContain('className="text-sm text-warning">\n        {copy.reviewNote}');
});
