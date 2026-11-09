import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "apps/web/src/components/verification-workspace.tsx"),
  "utf8",
);

/** Honesty lock: verification workspace write/intent notices → ErrorState with stable ids. */
it("locks verification workspace write and unconfirmed-submit notices to ErrorState with stable ids", () => {
  expect(source).toContain('import { Button, EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="verification-workspace-write-failed"');
  expect(source).toContain('id="verification-workspace-submit-unconfirmed"');
  expect(source).toMatch(
    /verifiedKey !== identityKey && writeError \? \(\s*<ErrorState\s+id="verification-workspace-write-failed"\s+title=\{writeError\}\s*\/>/u,
  );
  expect(source).toMatch(
    /writeError \? \(\s*<ErrorState\s+id="verification-workspace-write-failed"\s+title=\{writeError\}\s*\/>/u,
  );
  expect(source).toMatch(
    /intent \? \(\s*<ErrorState\s+id="verification-workspace-submit-unconfirmed"\s+title=\{\s*locale === "ru"/u,
  );
  expect(source).toContain(
    "The submission result is unconfirmed. Only an exact retry of the original application is available.",
  );
  expect(source).not.toContain('role="alert"');
});
