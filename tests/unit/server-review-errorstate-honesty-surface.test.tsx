import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "site/src/components/server-review-panel.tsx"), "utf8");

it("locks server review write fail/unknown/conflict to ErrorState and keeps success as status", () => {
  expect(source).toContain(
    'import { Button, EmptyState, ErrorState, fieldClassBlock } from "@nexus/ui"',
  );
  expect(source).toContain('id="server-review-write-error"');
  expect(source).toContain("<ErrorState");
  expect(source).toContain(
    "setNotice({ text: serverReviewError(locale, value?.code), error: true })",
  );
  expect(source).toContain("setNotice({ text: copy.unknown, error: true })");
  expect(source).toContain("setNotice({ text: copy.changed, error: true })");
  expect(source).toContain("setNotice({ text: copy.latestUnavailable, error: true })");
  expect(source).toContain("error: false");
  expect(source).toContain("copy.saved");
  expect(source).toContain("loadCopy.reloadReason");
  expect(source).toContain('role="status"');
  expect(source).toMatch(/notice && !notice\.error \? \(\s*<p[\s\S]*?role="status"/u);
  expect(source).toMatch(/copy\.reload/u);
  expect(source).not.toContain('<p role="status">{message}</p>');
  expect(source).not.toContain(
    '<p\n          ref={statusRef}\n          id={statusId}\n          role="status"\n          tabIndex={-1}\n          className="text-sm outline-none"\n        >\n          {message}\n        </p>',
  );
  expect(source).not.toContain('role={notice.error ? "alert" : "status"}');
  expect(source).toContain("title={loadCopy.unavailable}");
});
