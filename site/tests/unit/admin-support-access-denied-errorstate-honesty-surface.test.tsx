import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");
const source = read("site/src/features/support/server/admin-support-layout.tsx");

/** Honesty lock: admin support access-denied muted copy → ErrorState. */
it("locks admin support access denied to ErrorState with home recovery", () => {
  expect(source).toContain('import { ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="admin-support-access-denied"');
  expect(source).toContain("title={dictionary.admin.accessDenied}");
  expect(source).toContain("description={dictionary.admin.accessDeniedDescription}");
  expect(source).toContain("ShieldAlert");
  expect(source).toContain("dictionary.errors.home");
  expect(source).toMatch(/(?:min-h-11|link[A-Za-z]\w*|link-shell)/);
  expect(source).toMatch(/(?:overflow-x-clip|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/);
  expect(source).not.toContain("font-caption text-muted");
  expect(source).not.toContain("font-display text-primary");
  expect(source).not.toMatch(
    /<p className="font-caption text-muted">\{dictionary\.admin\.accessDeniedDescription\}<\/p>/u,
  );
});

it("locks admin verification stale proof warning to ErrorState", () => {
  const queue = read(
    "site/src/features/moderation/components/admin-verification-queue-section.tsx",
  );
  expect(queue).toContain('id="admin-verification-proof-stale"');
  expect(queue).toContain("title={copy.verificationProofStale}");
  expect(queue).toContain("description={copy.verificationProofStaleHint}");
  expect(queue).not.toContain('role="note" className="text-xs text-warning"');
  expect(read("site/src/lib/i18n/en/admin.ts")).toContain("verificationProofStaleHint:");
  expect(read("site/src/lib/i18n/ru/admin.ts")).toContain("verificationProofStaleHint:");
});
