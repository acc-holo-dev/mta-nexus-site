import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/** Honesty lock: discussion/resource/server recovery copy stays dictionary-backed. */
it("locks content-discussion recovery save to content-discussion-copy", () => {
  const source = read("site/src/features/community/components/content-discussion.tsx");
  const copy = read("site/src/features/community/content-discussion-copy.ts");
  expect(copy).toContain("recoverySaveFailed:");
  expect(source).toContain("copy.recoverySaveFailed");
  expect(source).not.toContain("Could not save recovery data. The comment was not sent.");
});

it("locks new-resource recovery strings to publishing dictionary", () => {
  const source = read("site/src/features/resources/components/new-resource-form.tsx");
  const copy = read("site/src/lib/i18n/en/publishing.ts");
  expect(copy).toContain("restoreFailed:");
  expect(copy).toContain("recoverySaveFailed:");
  expect(copy).toContain("creationUnconfirmed:");
  expect(copy).toContain("buildUnconfirmed:");
  expect(source).toContain("copy.restoreFailed");
  expect(source).toContain("copy.recoverySaveFailed");
  expect(source).toContain("copy.creationUnconfirmed");
  expect(source).toContain("copy.buildUnconfirmed");
  expect(source).not.toContain("Could not verify the session or restore the submission.");
});

it("locks register-server recovery strings to serverRegistration dictionary", () => {
  const source = read("site/src/features/servers/components/register-server-form.tsx");
  const copy = read("site/src/lib/i18n/en/publishing.ts");
  expect(copy).toContain("listingNotConfirmed:");
  expect(copy).toContain("sessionChanged:");
  expect(source).toContain("copy.listingNotConfirmed");
  expect(source).toContain("copy.sessionChanged");
  expect(source).toContain("copy.resultCheckFailed");
  expect(source).not.toContain("Could not verify your session or restore the draft.");
});
