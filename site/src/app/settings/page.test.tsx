import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "../../lib/i18n";

const mocks = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));

vi.mock("../../lib/i18n-server", () => ({
  getRequestLocale: async () => mocks.locale,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
}));

import { LocaleProvider } from "../../components/locale-context";
import SettingsLoading from "./loading";
import SettingsPage from "./page";

describe("account settings loading accessibility", () => {
  it.each(["en", "ru"] as const)(
    "renders the route loading shell with a stable heading id in %s",
    async (locale) => {
      mocks.locale = locale;
      const copy = getDictionary(locale).settings;
      const html = renderToStaticMarkup(await SettingsLoading());

      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-labelledby="settings-loading-heading"');
      expect(html).toContain('id="settings-loading-heading"');
      expect(html).toContain(copy.title);
      expect(html).toContain(copy.loading);
      expect(html).toContain("min-w-0");
      expect(html).toContain("overflow-x-clip");
    },
  );

  it.each(["en", "ru"] as const)(
    "renders the client page loading shell with the same heading contract in %s",
    (locale) => {
      mocks.locale = locale;
      const copy = getDictionary(locale).settings;
      const html = renderToStaticMarkup(
        <LocaleProvider locale={locale}>
          <SettingsPage />
        </LocaleProvider>,
      );

      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-labelledby="settings-loading-heading"');
      expect(html).toContain('id="settings-loading-heading"');
      expect(html).toContain(copy.title);
      expect(html).toContain(copy.loading);
      expect(html).toContain("min-w-0");
      expect(html).toContain("overflow-x-clip");
    },
  );
});
