import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "site/src/components/public-profile-form.tsx"), "utf8");

it("locks public profile form failures to ErrorState and keeps success as status", () => {
  expect(source).toContain('import { Avatar, Button, ErrorState, Input } from "@nexus/ui"');
  expect(source).toContain("<ErrorState title={notice.text} />");
  expect(source).toContain('role="status"');
  expect(source).toContain("text-success");
  expect(source).not.toContain('role={notice.error ? "alert" : "status"}');
  expect(source).not.toContain('role="alert"');
  expect(source).toMatch(/min-h-11|size="touch"/u);
});
