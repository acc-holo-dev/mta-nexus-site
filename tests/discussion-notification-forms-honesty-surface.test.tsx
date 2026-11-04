import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const formComponents = [
  "apps/web/src/components/notification-bell.tsx",
  "apps/web/src/components/notification-inbox.tsx",
  "apps/web/src/components/follow-button.tsx",
  "apps/web/src/components/content-follow-controls.tsx",
  "apps/web/src/components/context-switcher.tsx",
  "apps/web/src/components/community-report-form.tsx",
  "apps/web/src/components/content-comment-form.tsx",
  "apps/web/src/components/content-discussion-compose-feedback.tsx",
  "apps/web/src/components/discussion-comment-actions.tsx",
  "apps/web/src/components/discussion-report-batch.tsx",
  "apps/web/src/components/moderated-discussion-removal.tsx",
  "apps/web/src/components/mta-meta-inspector-panel.tsx",
  "apps/web/src/components/publication-reports-page.tsx",
  "apps/web/src/components/server-statistics-export-button.tsx",
] as const;

it("locks discussion and notification form failures to ErrorState with touch CTAs", () => {
  for (const path of formComponents) {
    const source = read(path);
    expect(source, path).toContain("ErrorState");
    expect(source, path).toMatch(/min-h-11|size="touch"/u);
    expect(source, path).not.toContain('role="alert"');
  }
});

it("keeps additive formErrorHint / errorHint copy for discussion and notification honesty", () => {
  expect(read("apps/web/src/lib/i18n/en/chrome.ts")).toContain(
    "Retry refreshes this preview only. It does not mark notifications as read.",
  );
  expect(read("apps/web/src/lib/i18n/ru/chrome.ts")).toContain(
    "Повтор обновляет только это превью. Он не отмечает уведомления прочитанными.",
  );
  expect(read("apps/web/src/lib/i18n/en/workspace.ts")).toContain(
    "Retry reloads the saved context list.",
  );
  expect(read("apps/web/src/lib/i18n/ru/workspace.ts")).toContain(
    "Повтор загружает сохранённый список контекстов.",
  );
  expect(read("apps/web/src/lib/i18n/en/publishing.ts")).toContain("commentErrorHint:");
  expect(read("apps/web/src/lib/i18n/ru/publishing.ts")).toContain("commentErrorHint:");
  expect(read("apps/web/src/lib/i18n/en/product.ts")).toContain(
    "Inspection did not finish. Choose the same meta.xml again",
  );
  expect(read("apps/web/src/lib/i18n/ru/product.ts")).toContain("Проверка не завершена.");
  expect(read("apps/web/src/lib/notification-inbox-copy.ts")).toContain("formErrorHint:");
  expect(read("apps/web/src/lib/follow-workspace-copy.ts")).toContain(
    "Retry reloads the saved follow state.",
  );
  expect(read("apps/web/src/lib/community-report-copy.ts")).toContain("formErrorHint:");
  expect(read("apps/web/src/lib/content-discussion-copy.ts")).toContain("formErrorHint:");
  expect(read("apps/web/src/lib/report-batch-copy.ts")).toContain("formErrorHint:");
  expect(read("apps/web/src/lib/moderated-discussion-copy.ts")).toContain("formErrorHint:");
  expect(read("apps/web/src/lib/server-statistics-copy.ts")).toContain("exportErrorHint:");
});
