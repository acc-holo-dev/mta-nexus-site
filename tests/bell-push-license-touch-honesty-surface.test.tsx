import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks notification bell empty preview to EmptyState with emptyHint honesty copy", () => {
  const source = read("apps/web/src/components/notification-bell.tsx");
  expect(source).toContain("EmptyState");
  expect(source).toContain("ErrorState");
  expect(source).toContain("copy.empty");
  expect(source).toContain("copy.emptyHint");
  expect(source).not.toMatch(
    /<div className="py-6 text-center font-caption text-muted">\{copy\.empty\}<\/div>/u,
  );

  const en = read("apps/web/src/lib/i18n/en/chrome.ts");
  const ru = read("apps/web/src/lib/i18n/ru/chrome.ts");
  expect(en).toContain("emptyHint:");
  expect(ru).toContain("emptyHint:");
  expect(en).toContain(
    "New notifications appear in this preview when activity reaches your account.",
  );
  expect(ru).toContain(
    "Новые уведомления появятся в этом превью, когда активность дойдёт до аккаунта.",
  );
});

it("locks web push enable/disable CTAs to size=touch without size=sm", () => {
  const source = read("apps/web/src/components/web-push-settings.tsx");
  expect(source).toContain('size="touch"');
  expect(source).not.toContain('size="sm"');
  expect(source.match(/size="touch"/gu)?.length ?? 0).toBeGreaterThanOrEqual(2);
  expect(source).toContain("void requestDisable()");
  expect(source).toContain("void enable()");
  expect(source).toContain("webPushDisable");
  expect(source).toContain("webPushEnable");
});

it("locks license control ghost CTAs to size=touch without size=sm stragglers", () => {
  const source = read("apps/web/src/components/license-control-panel.tsx");
  expect(source).toContain("EmptyState");
  expect(source).toContain('size="touch"');
  expect(source).not.toContain('size="sm"');
  expect(source).not.toContain("min-h-10");
  expect(source.match(/size="touch"/gu)?.length ?? 0).toBeGreaterThanOrEqual(6);
  expect(source).toMatch(/min-h-11|size="touch"/u);
});
