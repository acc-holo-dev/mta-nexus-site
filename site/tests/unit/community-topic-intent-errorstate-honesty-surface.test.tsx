import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/community/components/community-topic-form.tsx"),
  "utf8",
);

it("routes community-topic pending/unknown recovery through ErrorState and keeps busy status", () => {
  expect(source).toContain('import { Button, ErrorState, Field } from "@nexus/ui"');
  expect(source).toContain(
    "{pending ? <ErrorState title={recoveryNotice || copy.topicPending} /> : null}",
  );
  expect(source).toContain('role="status"');
  expect(source).toContain("{copy.publishing}");
  expect(source).toContain("title={error}");
  expect(source).not.toMatch(
    /\{pending && \(\s*<p role="status" className="text-sm text-secondary">\s*\{recoveryNotice \|\| copy\.topicPending\}\s*<\/p>\s*\)\}/u,
  );
  expect(source).not.toContain('role="alert"');
});
