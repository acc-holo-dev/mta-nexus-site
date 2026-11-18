import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks article-card type badge to dictionary-backed platform copy", () => {
  const source = read("site/src/features/community/components/article-card.tsx");
  expect(source).toContain("getUserPlatformCopy(locale)[article.type]");
  expect(source).not.toContain('"Обзор"');
  expect(source).not.toContain('"Review"');
});

it("locks content moderation CONTENT_STATE_CHANGED through moderationError", () => {
  const source = read("site/src/features/community/components/content-moderation-controls.tsx");
  expect(source).toContain('moderationError(locale, "CONTENT_STATE_CHANGED")');
  expect(source).not.toContain('"Публикация изменилась');
  expect(source).not.toContain('"The publication changed');
});

it("locks server details saving status to dictionary savingLocked", () => {
  const form = read("site/src/features/servers/components/server-details-form.tsx");
  expect(form).toContain("copy.savingLocked");
  expect(form).not.toContain('"Сохранение выполняется');
  expect(form).not.toContain('"Saving. Fields are temporarily locked.');
  expect(read("site/src/lib/i18n/en/servers.ts")).toContain("savingLocked:");
  expect(read("site/src/lib/i18n/ru/servers.ts")).toContain("savingLocked:");
});
