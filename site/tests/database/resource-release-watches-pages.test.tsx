import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../src/components/locale-context";
import { ResourceReleaseWatchControl } from "../../src/components/resource-release-watch-control";

const state = vi.hoisted(() => ({
  user: { id: "usr_a" } as { id: string } | null,
  locale: "en" as "en" | "ru",
  page: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh() {} }),
  usePathname: () => "/workspace/library/watches",
}));
vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../../src/lib/services/resource-release-watches-service", () => ({
  resourceReleaseWatchesService: { page: state.page },
}));

import Page, { generateMetadata } from "../../src/app/workspace/library/watches/page";
import { resourceReleaseWatchesCopy } from "../../src/lib/resource-release-watches-i18n";

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_a" };
  state.locale = "en";
  state.page.mockResolvedValue({
    items: [
      {
        productId: "prd_a",
        title: "<Resource>",
        available: true,
        enabled: true,
        revision: 2,
        updatedAt: new Date("2026-10-11T00:00:00Z"),
        userId: "DO_NOT_RENDER",
        lastSequence: "DO_NOT_RENDER",
      },
    ],
    counts: { all: 22, enabled: 21, disabled: 1, unavailable: 0 },
    page: 2,
    totalPages: 3,
  });
});
it.each(["en", "ru"] as const)(
  "renders localized private watches and preserves filters (%s)",
  async (locale) => {
    state.locale = locale;
    const page = await Page({ searchParams: Promise.resolve({ filter: "enabled", page: "2" }) });
    const html = renderToStaticMarkup(<LocaleProvider locale={locale}>{page}</LocaleProvider>);
    expect(html).toContain("&lt;Resource&gt;");
    expect(html).toContain("filter=enabled");
    expect(html).not.toContain("DO_NOT_RENDER");
    expect(html).toContain("/settings");
    expect(html).toContain(
      locale === "ru" ? "Отключить уведомления" : "Stop release notifications",
    );
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: false });
  },
);
it("unavailable resources retain the stop action but expose no private title or versions link", async () => {
  const result = await state.page();
  state.page.mockResolvedValue({
    ...result,
    items: [{ ...result.items[0], available: false, title: null }],
  });
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      {await Page({ searchParams: Promise.resolve({}) })}
    </LocaleProvider>,
  );
  expect(html).toContain("Resource currently unavailable");
  expect(html).toContain("Stop release notifications");
  expect(html).not.toContain("Resource&gt;");
  expect(html).not.toContain("/versions");
});
it("disabled watches cannot be enabled from an unavailable projection", () => {
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      <ResourceReleaseWatchControl
        watch={{ productId: "prd_a", enabled: false, revision: 1, updatedAt: null }}
        available={false}
      />
    </LocaleProvider>,
  );
  expect(html).toContain('disabled=""');
  expect(html).toContain('type="button"');
  expect(html).not.toContain("aria-busy=");
});
it("authenticates early and invalid duplicate filters never reach the repository", async () => {
  state.user = null;
  expect(
    renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ owner: "other" }) })),
  ).toContain('href="/auth/login?next=%2Fworkspace%2Flibrary%2Fwatches"');
  expect(state.page).not.toHaveBeenCalled();
  state.user = { id: "usr_a" };
  const invalid = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ filter: ["enabled", "disabled"] }) }),
  );
  const copy = resourceReleaseWatchesCopy("en");
  expect(invalid).toContain(copy.invalid);
  expect(invalid).toContain(copy.invalidDescription);
  expect(invalid).toContain('role="alert"');
  expect(invalid).toContain("overflow-x-clip");
  expect(state.page).not.toHaveBeenCalled();
});

it("shows an honest recovery state when release watches fail to load", async () => {
  state.page.mockRejectedValue(new Error("watches unavailable"));
  const copy = resourceReleaseWatchesCopy("en");
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      {await Page({ searchParams: Promise.resolve({ filter: "enabled", page: "2" }) })}
    </LocaleProvider>,
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain(copy.loadUnavailableDescription);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("filter=enabled");
  expect(html).toContain("page=2");
  expect(html).not.toContain("watches unavailable");
});

it.each(["en", "ru"] as const)(
  "distinguishes lifetime-empty watches from filtered-empty results in %s",
  async (locale) => {
    const copy = resourceReleaseWatchesCopy(locale);
    expect(copy.emptyFiltered).not.toBe(copy.empty);
    state.locale = locale;
    state.page.mockResolvedValueOnce({
      items: [],
      counts: { all: 0, enabled: 0, disabled: 0, unavailable: 0 },
      page: 1,
      totalPages: 1,
      activeWatchCount: 0,
    });
    const lifetime = renderToStaticMarkup(
      <LocaleProvider locale={locale}>
        {await Page({ searchParams: Promise.resolve({}) })}
      </LocaleProvider>,
    );
    expect(lifetime).toContain(copy.empty);
    expect(lifetime).toContain(copy.emptyHint);
    expect(lifetime).toContain("overflow-x-clip");
    expect(lifetime).not.toContain(copy.emptyFiltered);
    state.page.mockResolvedValueOnce({
      items: [],
      counts: { all: 3, enabled: 0, disabled: 3, unavailable: 0 },
      page: 1,
      totalPages: 1,
      activeWatchCount: 0,
    });
    const filtered = renderToStaticMarkup(
      <LocaleProvider locale={locale}>
        {await Page({ searchParams: Promise.resolve({ filter: "enabled", query: "Core" }) })}
      </LocaleProvider>,
    );
    expect(filtered).toContain(copy.emptyFiltered);
    expect(filtered).toContain(copy.emptyFilteredHint);
    expect(filtered).not.toContain(copy.empty);
    expect(filtered).toContain(copy.reset);
    expect(filtered).toContain('href="/workspace/library/watches"');
  },
);

it("preserves search in filters, pagination and export, and masks unavailable upstream titles", async () => {
  const result = await state.page();
  state.page.mockResolvedValue({
    ...result,
    items: [{ ...result.items[0], available: false, title: "PRIVATE-TITLE" }],
  });
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      {
        await Page({
          searchParams: Promise.resolve({ filter: "enabled", page: "2", query: "Core" }),
        })
      }
    </LocaleProvider>,
  );
  expect(html).not.toContain("PRIVATE-TITLE");
  expect(html).toContain("query=Core");
  expect(html).toContain("/api/library/watches/export?filter=enabled&amp;page=2&amp;query=Core");
  expect(html).toContain("Stop several release watches");
  expect(html).toContain("Resource currently unavailable");
});

it.each(["en", "ru"] as const)(
  "shows reviewed resumption and an account-wide active count in %s",
  async (locale) => {
    state.locale = locale;
    const result = await state.page();
    state.page.mockResolvedValue({
      ...result,
      activeWatchCount: 98,
      items: [{ ...result.items[0], enabled: false }],
    });
    const html = renderToStaticMarkup(
      <LocaleProvider locale={locale}>
        {await Page({ searchParams: Promise.resolve({ filter: "disabled", query: "Core" }) })}
      </LocaleProvider>,
    );
    expect(html).toContain(
      locale === "en" ? "Resume stopped release watches" : "Возобновить отключённые подписки",
    );
    expect(html).toContain("98 / 100");
    expect(html).not.toContain("DO_NOT_RENDER");
  },
);
