import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/resource-moderation-controls.tsx"),
  "utf8",
);

it("locks release-returns-draft notice to ErrorState without soft text-warning", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="resource-moderation-release-draft"');
  expect(source).toContain(
    "Release returns a draft and requires a new review. Nothing is auto-published.",
  );
  expect(source).toMatch(
    /release \? \(\s*<ErrorState\s+id="resource-moderation-release-draft"\s+title=\{/u,
  );
  expect(source).not.toContain('className="text-sm text-warning"');
  expect(source).not.toContain(
    'className="text-sm text-warning">\n          {locale === "ru"\n            ? "Снятие ограничения возвращает черновик и требует новой проверки. Автоматической публикации нет."\n            : "Release returns a draft and requires a new review. Nothing is auto-published."}',
  );
});
