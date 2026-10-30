import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "actor", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  page: vi.fn(),
  directory: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("@nexus/db", () => ({ serverRepository: { pageManagedByUser: state.page } }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../apps/web/src/lib/services/mta-master-directory-service")
    >();
  return { ...actual, mtaMasterDirectoryService: { getDirectory: state.directory } };
});

import ManagedServersPage, { generateMetadata } from "../apps/web/src/app/workspace/servers/page";

const server = {
  id: "private-server",
  name: "Managed Organization",
  slug: "private-slug",
  ipAddress: "203.0.113.7",
  port: 22003,
  organizationId: "organization",
  visibility: "private",
  status: "maintenance",
  isVerified: true,
  updatedAt: new Date("2026-10-09T12:00:00Z"),
};
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "actor", role: "user" };
  state.locale = "en";
  state.page.mockResolvedValue({
    servers: [server],
    total: 125,
    page: 2,
    pageSize: 12,
    totalPages: 11,
  });
  state.directory.mockResolvedValue({
    servers: [{ address: "203.0.113.7", port: 22003, responding: true, players: 17 }],
    isStale: false,
  });
});
const render = async (query: Record<string, string | string[] | undefined> = {}) =>
  renderToStaticMarkup(await ManagedServersPage({ searchParams: Promise.resolve(query) }));
it.each(["en", "ru"] as const)(
  "renders accessible localized filters and private management links in %s",
  async (locale) => {
    state.locale = locale;
    const html = await render({
      page: "2",
      q: "Managed",
      visibility: "private",
      verification: "verified",
      status: "maintenance",
    });
    expect(state.page).toHaveBeenCalledExactlyOnceWith(
      "actor",
      2,
      {
        query: "Managed",
        visibility: "private",
        verification: "verified",
        status: "maintenance",
      },
      20,
    );
    expect(html).toContain("<search");
    expect(html).toContain('name="visibility"');
    expect(html).toContain("rounded-lg");
    expect(html).toContain("bg-accent");
    expect(html).toContain(locale === "ru" ? "Управляемые серверы" : "Managed servers");
    expect(html).toContain(locale === "ru" ? "Обслуживание" : "Maintenance");
    expect(html).toContain(locale === "ru" ? "Онлайн" : "Online");
    expect(html).toContain("17");
    expect(html).toContain("125");
    expect(html).toContain('href="/workspace/servers/private-server"');
    expect(html).not.toContain('href="/servers/private-slug"');
    expect(html).toContain(
      "q=Managed&amp;status=maintenance&amp;visibility=private&amp;verification=verified&amp;page=3",
    );
    expect(html).not.toContain("undefined");
  },
);
it("does not read private data or contact the directory for anonymous visitors", async () => {
  state.user = null;
  expect(await render()).toContain("Sign in to manage your servers");
  expect(state.page).not.toHaveBeenCalled();
  expect(state.directory).not.toHaveBeenCalled();
  expect((await generateMetadata()).robots).toEqual({ index: false, follow: false });
});
it("avoids directory work for empty filters and offers a reset", async () => {
  state.page.mockResolvedValue({ servers: [], total: 0, page: 1, pageSize: 12, totalPages: 1 });
  const html = await render({ q: "missing" });
  expect(html).toContain("No servers match these filters");
  expect(html).toContain("Reset filters");
  expect(state.directory).not.toHaveBeenCalled();
});
it.each(["missing", "stale", "failure"])(
  "keeps %s observations unknown without showing stale player counts",
  async (scenario) => {
    if (scenario === "failure") state.directory.mockRejectedValue(new Error("upstream failure"));
    else if (scenario === "missing")
      state.directory.mockResolvedValue({ servers: [], isStale: false });
    else
      state.directory.mockResolvedValue({
        servers: [{ address: "203.0.113.7", port: 22003, responding: false, players: 999 }],
        isStale: true,
      });
    const html = await render();
    expect(html).toContain("Unknown");
    expect(html).not.toContain(">Offline<");
    expect(html).not.toContain("999");
  },
);
it("keeps listing maintenance independent from a fresh explicit offline observation", async () => {
  state.directory.mockResolvedValue({
    servers: [{ address: "203.0.113.7", port: 22003, responding: false, players: 0 }],
    isStale: false,
  });
  expect(await render()).toContain("Offline");
  expect(await render()).toContain("Maintenance");
});
it("escapes stored names and exposes public links only for eligible listings", async () => {
  state.page.mockResolvedValue({
    servers: [{ ...server, name: "<script>alert('x')</script>", visibility: "unlisted" }],
    total: 1,
    page: 1,
    pageSize: 12,
    totalPages: 1,
  });
  const html = await render();
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain('href="/servers/private-slug"');
});
it("does not disguise a failed database read as an empty workspace", async () => {
  state.page.mockRejectedValue(new Error("Database unavailable"));
  const html = await render();
  expect(html).toContain('role="alert"');
  expect(html).toContain("temporarily unavailable");
  expect(html).not.toContain("Database unavailable");
  expect(state.directory).not.toHaveBeenCalled();
});
