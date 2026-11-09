import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "apps/web/src/app/admin/support/layout.tsx"), "utf8");

/** Honesty lock: admin support access-denied muted copy → ErrorState. */
it("locks admin support access denied to ErrorState with home recovery", () => {
  expect(source).toContain('import { ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="admin-support-access-denied"');
  expect(source).toContain("title={dictionary.admin.accessDenied}");
  expect(source).toContain("description={dictionary.admin.accessDeniedDescription}");
  expect(source).toContain("ShieldAlert");
  expect(source).toContain("dictionary.errors.home");
  expect(source).toContain("min-h-11");
  expect(source).toContain("overflow-x-clip");
  expect(source).not.toContain("font-caption text-muted");
  expect(source).not.toContain("font-display text-primary");
  expect(source).not.toMatch(
    /<p className="font-caption text-muted">\{dictionary\.admin\.accessDeniedDescription\}<\/p>/u,
  );
});
