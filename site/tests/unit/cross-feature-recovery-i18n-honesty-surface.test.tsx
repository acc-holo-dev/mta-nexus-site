import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/** Honesty lock: cross-feature recovery restore/save failures stay dictionary-backed. */
it("locks community-report recovery strings to community-report-copy", () => {
  const source = read("site/src/features/community/components/community-report-form.tsx");
  const copy = read("site/src/features/community/community-report-copy.ts");
  expect(copy).toContain("restoreFailed:");
  expect(copy).toContain("recoverySaveFailed:");
  expect(source).toContain(".restoreFailed");
  expect(source).toContain("copy.recoverySaveFailed");
  expect(source).not.toContain("Could not verify the session or restore the report.");
  expect(source).not.toContain("const message = (ru: string, en: string)");
});

it("locks organization-profile recovery strings to organization-workspace-copy", () => {
  const source = read("site/src/features/organizations/components/organization-profile-form.tsx");
  const copy = read("site/src/features/organizations/organization-workspace-copy.ts");
  expect(copy).toContain("restoreFailed:");
  expect(copy).toContain("creationUnconfirmed:");
  expect(copy).toContain("resultCheckFailed:");
  expect(source).toContain(".restoreFailed");
  expect(source).toContain("copy.creationUnconfirmed");
  expect(source).toContain("copy.resultCheckFailed");
  expect(source).not.toContain("const text = (ru: string, en: string)");
  expect(source).not.toContain("Could not verify the session or restore the draft.");
});

it("locks library-collection-command recovery strings to library-collections-i18n", () => {
  const source = read("site/src/features/library/components/library-collection-command.tsx");
  const copy = read("site/src/features/library/library-collections-i18n.ts");
  expect(copy).toContain("restoreFailed:");
  expect(copy).toContain("recoverySaveFailed:");
  expect(source).toContain(".restoreFailed");
  expect(source).toContain("c.recoverySaveFailed");
  expect(source).not.toContain("Could not check the session or restore the collection.");
});

it("locks verification-workspace recovery strings to verification-workspace-copy", () => {
  const source = read("site/src/features/moderation/components/verification-workspace.tsx");
  const copy = read("site/src/features/trust/verification-workspace-copy.ts");
  expect(copy).toContain("restoreFailed:");
  expect(copy).toContain("recoverySaveFailed:");
  expect(copy).toContain("submissionUnconfirmed:");
  expect(copy).toContain("pendingExists:");
  expect(source).toContain(".restoreFailed");
  expect(source).toContain("copy.recoverySaveFailed");
  expect(source).toContain("copy.submissionUnconfirmed");
  expect(source).toContain("copy.pendingExists");
  expect(source).not.toContain("Could not verify the account or restore the application.");
  expect(source).not.toContain(
    "An application already exists for this target. Its author and contents are unconfirmed.",
  );
});
