import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for commercial-plan unknown prior-operation marker via ErrorState. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(join(root, "apps/web/src/components/commercial-plan-form.tsx"), "utf8");

it("locks commercial-plan unknown operation marker to ErrorState without soft note", () => {
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="commercial-plan-operation-unknown"');
  expect(source).toContain(
    "The previous operation result is unknown. Check the list and history before clearing this warning.",
  );
  expect(source).toContain(
    "Результат предыдущей операции неизвестен. Проверьте список и историю перед снятием блокировки.",
  );
  expect(source).toMatch(/marker \? \(\s*<ErrorState\s+id="commercial-plan-operation-unknown"/u);
  expect(source).not.toContain('<div className="space-y-2" role="note">');
  expect(source).not.toMatch(/marker \? \(\s*<div className="space-y-2" role="note">/u);
});
