import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "site/src/components/resource-review-controls.tsx"), "utf8");

it("locks resource review fail/unknown to ErrorState and keeps success as status", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain('<ErrorState id="resource-review-editor-error" title={notice.text} />');
  expect(source).toContain('<ErrorState id="resource-review-report-error" title={notice.text} />');
  expect(source).toContain(
    '<ErrorState id="resource-review-decision-error" title={notice.text} />',
  );
  expect(source).toContain(
    "setNotice({ text: resourceReviewError(locale, result.value?.code), error: true })",
  );
  expect(source).toContain("setNotice({ text: copy.unknown, error: true })");
  expect(source).toContain("setNotice({ text: copy.saved, error: false })");
  expect(source).toContain("setNotice({ text: copy.reportSaved, error: false })");
  expect(source).toContain('role="status"');
  expect(source).toMatch(/notice && !notice\.error \? \(\s*<p role="status"/u);
  expect(source).not.toContain('<p role="status">{message}</p>');
  expect(source).not.toContain(
    '<p role="status" className="text-sm">\n        {message}\n      </p>',
  );
  expect(source).not.toContain('role={notice.error ? "alert" : "status"}');
  expect(source).not.toContain('role="alert"');
});

it("locks resource review eligibility notice to ErrorState and drops soft warning markup", () => {
  expect(source).toContain(
    '<ErrorState id="resource-review-eligibility" title={eligibilityNote} />',
  );
  expect(source).toMatch(
    /\{eligibilityNote \? \(\s*<ErrorState id="resource-review-eligibility" title=\{eligibilityNote\} \/>\s*\) : null\}/u,
  );
  expect(source).not.toContain('<p role="note" className="text-sm text-warning">');
  expect(source).not.toMatch(
    /\{eligibilityNote \? \(\s*<p role="note" className="text-sm text-warning">/u,
  );
});
