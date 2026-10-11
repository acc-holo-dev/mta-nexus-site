import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

const state = vi.hoisted(() => ({
  session: null as null | { id: string; username: string; role: string },
  redirects: [] as string[],
}));

const repos = vi.hoisted(() => ({
  saved: vi.fn(),
  follows: vi.fn(),
  products: vi.fn(),
  servers: vi.fn(),
  directory: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    state.redirects.push(target);
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "nexus_session" && state.session ? { value: "session-token" } : undefined,
  })),
}));

vi.mock("@nexus/db", () => ({
  followWorkspaceRepository: { page: repos.saved },
  socialRepository: { listFollows: repos.follows },
  productRepository: { listPublishedFreeByIds: repos.products },
  serverRepository: { listActivePublicByIds: repos.servers },
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.session),
  },
}));

vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));

vi.mock("../apps/web/src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: { getDirectory: repos.directory },
  indexMtaObservations: vi.fn(() => () => undefined),
}));

import SavedPage from "../apps/web/src/app/workspace/saved/page";
import LicensesPage from "../apps/web/src/app/workspace/licenses/page";
import PurchasesPage from "../apps/web/src/app/workspace/purchases/page";
import SalesPage from "../apps/web/src/app/workspace/sales/page";

describe("closed-beta workspace behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.session = null;
    state.redirects.length = 0;
    repos.follows.mockResolvedValue([]);
    repos.saved.mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
    repos.products.mockResolvedValue([]);
    repos.servers.mockResolvedValue([]);
    repos.directory.mockResolvedValue({ servers: [], isStale: false });
  });

  it("does not read a private saved collection for an anonymous visitor", async () => {
    const page = await SavedPage();

    expect(page).toBeTruthy();
    expect(repos.follows).not.toHaveBeenCalled();
    expect(repos.saved).not.toHaveBeenCalled();
    expect(repos.products).not.toHaveBeenCalled();
    expect(repos.servers).not.toHaveBeenCalled();
    expect(repos.directory).not.toHaveBeenCalled();
  });

  it("loads a bounded saved page through the session-scoped repository", async () => {
    state.session = {
      id: "usr_saved",
      username: "saved",
      role: "user",
    };
    await SavedPage();
    expect(repos.saved).toHaveBeenCalledWith("usr_saved", {
      query: "",
      type: undefined,
      cursor: undefined,
    });
    expect(repos.follows).not.toHaveBeenCalled();
    expect(repos.products).not.toHaveBeenCalled();
    expect(repos.servers).not.toHaveBeenCalled();
  });

  it("does not call the master directory when no saved public servers survive filtering", async () => {
    state.session = {
      id: "usr_saved",
      username: "saved",
      role: "user",
    };
    repos.follows.mockResolvedValue([
      { followerId: "usr_saved", targetType: "server", targetId: "srv_private" },
    ]);
    repos.servers.mockResolvedValue([]);

    await SavedPage();

    expect(repos.directory).not.toHaveBeenCalled();
  });

  it("keeps RU/EN saved-page copy distinct", () => {
    const en = getDictionary("en").savedPage;
    const ru = getDictionary("ru").savedPage;
    expect(en.title).not.toBe(ru.title);
    expect(en.noServers).not.toBe(ru.noServers);
  });

  it("keeps read-only commerce archives behind sign-in for anonymous visitors", async () => {
    const input = { searchParams: Promise.resolve({}) };
    for (const page of [LicensesPage, PurchasesPage, SalesPage]) {
      const html = renderToStaticMarkup(await page(input));
      expect(html).toContain("Sign in to view your private history");
      expect(html).toContain('href="/auth/login"');
    }
    expect(state.redirects).toEqual([]);
  });
});
