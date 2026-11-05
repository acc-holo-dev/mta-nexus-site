import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/community-topic-form.tsx"), "utf8");

it("routes community-topic pending/unknown recovery through ErrorState and keeps busy status", () => {
  expect(source).toContain('import { Button, ErrorState, Field } from "@nexus/ui"');
  expect(source).toMatch(
    /pending \? \(\s*<ErrorState title=\{recoveryNotice \|\| copy\.topicPending\} \/>\s*\) : null/u,
  );
  expect(source).toContain('role="status"');
  expect(source).toContain("{copy.publishing}");
  expect(source).toContain("title={error}");
  expect(source).not.toMatch(
    /\{pending && \(\s*<p role="status" className="text-sm text-secondary">\s*\{recoveryNotice \|\| copy\.topicPending\}\s*<\/p>\s*\)\}/u,
  );
  expect(source).not.toContain('role="alert"');
});
