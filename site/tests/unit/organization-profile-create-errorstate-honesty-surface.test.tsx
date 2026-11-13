import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/components/organization-profile-form.tsx"),
  "utf8",
);

it("locks organization create unknown/fail notices to ErrorState and keeps save success as status", () => {
  expect(source).toContain('import { Button, ErrorState, Input } from "@nexus/ui"');
  expect(source).toContain("<ErrorState title={creationNotice} />");
  expect(source).toContain("{error && <ErrorState title={error} />}");
  expect(source).toContain('role="status"');
  expect(source).toContain("{copy.saved}");
  expect(source).not.toContain('<p role="status">{creationNotice}</p>');
  expect(source).not.toContain('role="alert"');
});
