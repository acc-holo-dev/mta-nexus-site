import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for verification application amend soft notice ErrorState (stable id + alert role via ErrorState). */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "site/src/components/verification-application-amend.tsx"),
  "utf8",
);

it("locks verification amend failure notice to ErrorState with stable id", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="verification-amend-notice"');
  expect(source).toMatch(
    /\{notice && !saved \? <ErrorState id="verification-amend-notice" title=\{notice\} \/> : null\}/,
  );
  expect(source).not.toContain("{notice && !saved ? <ErrorState title={notice} /> : null}");
});

it("keeps successful verification amend confirmation on role=status", () => {
  expect(source).toContain('role="status"');
  expect(source).toContain("text-success");
  expect(source).toMatch(
    /\{notice && saved \? \(\s*<p role="status" className="text-sm text-success">\s*\{notice\}\s*<\/p>\s*\) : null\}/u,
  );
});
