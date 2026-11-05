import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/server-claim-control-panel.tsx"),
  "utf8",
);

it("locks server-claim unknown_issue/unknown_verify notices to ErrorState", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain('state === "unknown_issue" || state === "unknown_verify"');
  expect(source).toContain("<ErrorState");
  expect(source).toContain("The challenge result is unknown.");
  expect(source).toContain("The verification result is unknown.");
  expect(source).toContain('href="/workspace/verification"');
  expect(source).toContain("{error ? <ErrorState title={error} /> : null}");
  expect(source).not.toContain('className="space-y-2 text-sm text-secondary" role="status"');
  expect(source).not.toMatch(
    /unknown_issue[\s\S]{0,120}role="status"|role="status"[\s\S]{0,120}unknown_issue/u,
  );
});

it("keeps session-check loading on role=status without treating unknowns as soft status", () => {
  expect(source).toContain('role="status"');
  expect(source).toContain("Checking the session before showing the token…");
  expect(source).toContain("border-[color:var(--nexus-success)]/20");
  expect(source).toContain("{copy.verifiedTitle}");
});
