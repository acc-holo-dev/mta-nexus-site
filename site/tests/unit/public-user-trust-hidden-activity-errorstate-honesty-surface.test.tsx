import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/trust/components/public-user-trust.tsx"),
  "utf8",
);

/** Honesty lock for hidden public-user trust activity notice. */
it("locks hidden activity notice to ErrorState", () => {
  expect(source).toContain('import { Avatar, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="public-user-trust-hidden-activity"');
  expect(source).toContain('id="public-user-trust-hidden-activity"');
  expect(source).toContain("title={copy.hiddenActivity}");
  expect(source).toContain("description={copy.hiddenActivityHint}");
  expect(source).not.toContain('<p className="text-sm text-muted">{copy.hiddenActivity}</p>');
});
