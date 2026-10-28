import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children: React.ReactNode;
      [key: string]: unknown;
    }) => ReactModule.createElement("a", { href, ...props }, children),
  };
});

vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => state.locale),
}));

vi.mock("../apps/web/src/components/mta-master-server-directory", async () => {
  const ReactModule = await import("react");
  return {
    MtaMasterServerDirectory: ({ locale }: { locale: string }) =>
      ReactModule.createElement("section", {
        "data-testid": "mta-directory",
        "data-locale": locale,
      }),
  };
});

import ServersPage from "../apps/web/src/app/servers/page";

describe("public MTA directory page behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.locale = "en";
  });

  it.each(["en", "ru"] as const)(
    "renders localized directory shell and one paginated client directory in %s",
    async (locale) => {
      state.locale = locale;
      const copy = getDictionary(locale).servers;
      const html = renderToStaticMarkup(await ServersPage());

      expect(html).toContain(copy.title);
      expect(html).toContain(copy.description);
      expect(html).toContain(copy.addListing);
      expect(html).toContain('href="/workspace/servers/new"');
      expect(html).toContain('data-testid="mta-directory"');
      expect(html).toContain(`data-locale="${locale}"`);
      expect((html.match(/data-testid="mta-directory"/gu) ?? []).length).toBe(1);
    },
  );
});
