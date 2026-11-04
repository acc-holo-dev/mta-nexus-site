import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
}));

import LoginPage from "../apps/web/src/app/auth/login/page";
import RegisterPage from "../apps/web/src/app/auth/register/page";
import SettingsPage from "../apps/web/src/app/settings/page";
import { LocaleProvider } from "../apps/web/src/components/locale-context";
import { getDictionary } from "../apps/web/src/lib/i18n";

beforeEach(() => {
  state.locale = "en";
});

const clippedShellPages = [
  "apps/web/src/app/settings/page.tsx",
  "apps/web/src/app/settings/history/page.tsx",
  "apps/web/src/app/auth/login/page.tsx",
  "apps/web/src/app/auth/register/page.tsx",
] as const;

it("locks residual settings and auth route shells to clipped min-w-0 frames", () => {
  for (const page of clippedShellPages) {
    const source = read(page);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toContain("pageShellClass");
  }
});

it("preserves settings and auth ErrorState/EmptyState honesty chrome under clipped shells", () => {
  const settingsClient = read("apps/web/src/components/settings-page-client.tsx");
  expect(settingsClient).toContain("ErrorState");
  expect(settingsClient).toContain("overflow-x-clip");
  expect(settingsClient).toContain("min-w-0");
  expect(settingsClient).toMatch(/min-h-11|size="touch"/u);
  expect(settingsClient).not.toContain('role="alert"');

  const authForm = read("apps/web/src/components/auth-form.tsx");
  expect(authForm).toContain("ErrorState");
  expect(authForm).toContain("overflow-x-clip");
  expect(authForm).toContain("min-w-0");
  expect(authForm).toMatch(/min-h-11|size="touch"/u);
  expect(authForm).not.toContain('role="alert"');

  const history = read("apps/web/src/components/profile-change-history.tsx");
  expect(history).toContain("ErrorState");
  expect(history).toContain("EmptyState");
  expect(history).toContain("overflow-x-clip");
  expect(history).toContain("min-w-0");
  expect(history).toMatch(/min-h-11|size="touch"/u);
  expect(history).not.toContain('role="alert"');
});

it("wraps settings history guest and authenticated returns in the clipped page shell", () => {
  const source = read("apps/web/src/app/settings/history/page.tsx");
  expect(source).toContain("PlatformSignIn");
  expect(source).toContain("ProfileChangeHistoryView");
  expect(source).toContain("pageShellClass");
  expect(source.match(/className=\{pageShellClass\}/gu)?.length).toBeGreaterThanOrEqual(2);
});

it.each(["en", "ru"] as const)(
  "renders clipped settings and auth entry shells without inventing results in %s",
  async (locale) => {
    state.locale = locale;
    const dictionary = getDictionary(locale);
    const settingsHtml = renderToStaticMarkup(
      <LocaleProvider locale={locale}>
        <SettingsPage />
      </LocaleProvider>,
    );
    expect(settingsHtml).toContain("overflow-x-clip");
    expect(settingsHtml).toContain("min-w-0");
    expect(settingsHtml).toContain(dictionary.settings.title);
    expect(settingsHtml).toContain(dictionary.settings.loading);

    const loginHtml = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(loginHtml).toContain("overflow-x-clip");
    expect(loginHtml).toContain("min-w-0");
    expect(loginHtml).toContain(dictionary.auth.loginTitle);

    const registerHtml = renderToStaticMarkup(
      await RegisterPage({ searchParams: Promise.resolve({}) }),
    );
    expect(registerHtml).toContain("overflow-x-clip");
    expect(registerHtml).toContain("min-w-0");
    expect(registerHtml).toContain(dictionary.auth.registerTitle);
  },
);
