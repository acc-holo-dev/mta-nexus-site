import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const formComponents = [
  "site/src/components/notification-bell.tsx",
  "site/src/components/notification-inbox.tsx",
  "site/src/components/follow-button.tsx",
  "site/src/components/content-follow-controls.tsx",
  "site/src/components/context-switcher.tsx",
  "site/src/components/community-report-form.tsx",
  "site/src/components/content-comment-form.tsx",
  "site/src/components/content-discussion-compose-feedback.tsx",
  "site/src/components/discussion-comment-actions.tsx",
  "site/src/components/discussion-report-batch.tsx",
  "site/src/components/moderated-discussion-removal.tsx",
  "site/src/components/mta-meta-inspector-panel.tsx",
  "site/src/components/publication-reports-page.tsx",
  "site/src/components/server-statistics-export-button.tsx",
] as const;

it("locks discussion and notification form failures to ErrorState with touch CTAs", () => {
  for (const path of formComponents) {
    const source = read(path);
    expect(source, path).toContain("ErrorState");
    expect(source, path).toMatch(/min-h-11|size="touch"/u);
    expect(source, path).not.toContain('role="alert"');
  }
});

it("locks notification bell empty preview to EmptyState with emptyHint copy", () => {
  const source = read("site/src/components/notification-bell.tsx");
  expect(source).toContain("EmptyState");
  expect(source).toContain("copy.empty");
  expect(source).toContain("copy.emptyHint");
  expect(source).not.toMatch(
    /<div className="py-6 text-center font-caption text-muted">\{copy\.empty\}<\/div>/u,
  );
  expect(read("site/src/lib/i18n/en/chrome.ts")).toContain("emptyHint:");
  expect(read("site/src/lib/i18n/ru/chrome.ts")).toContain("emptyHint:");
});

it("locks MTA meta inspector apply CTA to size=touch without min-h-8", () => {
  const source = read("site/src/components/mta-meta-inspector-panel.tsx");
  expect(source).toMatch(
    /onApplyMinimumVersion[\s\S]{0,120}?size="touch"|size="touch"[\s\S]{0,120}?onApplyMinimumVersion/u,
  );
  expect(source).toContain("min-h-11");
  expect(source).not.toContain("min-h-8");
});

it("locks context switcher native select to fieldControlClass without h-10 chrome", () => {
  const source = read("site/src/components/context-switcher.tsx");
  expect(source).toContain("fieldControlClass");
  expect(source).toContain("min-h-11");
  expect(source).not.toContain("h-10");
  expect(source).not.toContain("fieldClassBlock");
});

it("keeps additive formErrorHint / errorHint copy for discussion and notification honesty", () => {
  expect(read("site/src/lib/i18n/en/chrome.ts")).toContain(
    "Retry refreshes this preview only. It does not mark notifications as read.",
  );
  expect(read("site/src/lib/i18n/ru/chrome.ts")).toContain(
    "Повтор обновляет только это превью. Он не отмечает уведомления прочитанными.",
  );
  expect(read("site/src/lib/i18n/en/workspace.ts")).toContain(
    "Retry reloads the saved context list.",
  );
  expect(read("site/src/lib/i18n/ru/workspace.ts")).toContain(
    "Повтор загружает сохранённый список контекстов.",
  );
  expect(read("site/src/lib/i18n/en/publishing.ts")).toContain("commentErrorHint:");
  expect(read("site/src/lib/i18n/ru/publishing.ts")).toContain("commentErrorHint:");
  expect(read("site/src/lib/i18n/en/product.ts")).toContain(
    "Inspection did not finish. Choose the same meta.xml again",
  );
  expect(read("site/src/lib/i18n/ru/product.ts")).toContain("Проверка не завершена.");
  expect(read("site/src/lib/notification-inbox-copy.ts")).toContain("formErrorHint:");
  expect(read("site/src/lib/follow-workspace-copy.ts")).toContain(
    "Retry reloads the saved follow state.",
  );
  expect(read("site/src/lib/community-report-copy.ts")).toContain("formErrorHint:");
  expect(read("site/src/lib/content-discussion-copy.ts")).toContain("formErrorHint:");
  expect(read("site/src/lib/report-batch-copy.ts")).toContain("formErrorHint:");
  expect(read("site/src/lib/moderated-discussion-copy.ts")).toContain("formErrorHint:");
  expect(read("site/src/lib/server-statistics-copy.ts")).toContain("exportErrorHint:");
});
