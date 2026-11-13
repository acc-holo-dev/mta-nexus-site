import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "site/src/components/verification-workspace.tsx"), "utf8");

it("routes unconfirmed verification submit intent through ErrorState and keeps success as status", () => {
  expect(source).toContain('import { Button, EmptyState, ErrorState } from "@nexus/ui"');
  expect(source).toContain(
    '<ErrorState id="verification-workspace-write-failed" title={writeError} />',
  );
  expect(source).toMatch(
    /intent \? \(\s*<ErrorState\s+id="verification-workspace-submit-unconfirmed"\s+title=\{\s*locale === "ru"\s*\?\s*"Результат отправки не подтверждён\. Доступен только точный повтор исходной заявки\."\s*:\s*"The submission result is unconfirmed\. Only an exact retry of the original application is available\."\s*\}\s*\/>/u,
  );
  expect(source).toContain('role="status" className="text-sm text-success"');
  expect(source).toContain("{copy.submitted}");
  expect(source).not.toContain('<p role="status">');
  expect(source).not.toContain('role="alert"');
});
