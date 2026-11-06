import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/author-resource-forms.tsx"),
  "utf8",
);

it("locks author draft conflict notice to ErrorState with stable id", () => {
  expect(source).toContain('import { Button, ErrorState, Input } from "@nexus/ui"');
  expect(source).toContain('id="author-resource-draft-conflict"');
  expect(source).toContain("title={copy.draftConflict}");
  expect(source).toContain("description={copy.draftConflictDescription}");
  expect(source).toMatch(
    /conflict \? \(\s*<ErrorState[\s\S]*?id="author-resource-draft-conflict"[\s\S]*?title=\{copy\.draftConflict\}/u,
  );
  expect(source).not.toContain("<ErrorState\n            title={copy.draftConflict}");
});
