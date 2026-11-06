import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

vi.mock("next/headers", async () => {
  const { createWorkspaceLiveSourceHeadersMock } = await import(
    "./helpers/workspace-live-source-harness"
  );
  return createWorkspaceLiveSourceHeadersMock();
});
vi.mock("next/navigation", async () => {
  const { createWorkspaceLiveSourceNavigationMock } = await import(
    "./helpers/workspace-live-source-harness"
  );
  return createWorkspaceLiveSourceNavigationMock();
});
vi.mock("next/link", async () => {
  const { createWorkspaceLiveSourceLinkMock } = await import(
    "./helpers/workspace-live-source-harness"
  );
  return createWorkspaceLiveSourceLinkMock();
});
vi.mock("@nexus/db", async () => {
  const { createWorkspaceLiveSourceDbMock } = await import(
    "./helpers/workspace-live-source-harness"
  );
  return createWorkspaceLiveSourceDbMock();
});
vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { createWorkspaceLiveSourceAuthMock } = await import(
    "./helpers/workspace-live-source-harness"
  );
  return createWorkspaceLiveSourceAuthMock();
});
vi.mock("../apps/web/src/lib/i18n-server", async () => {
  const { createWorkspaceLiveSourceI18nMock } = await import(
    "./helpers/workspace-live-source-harness"
  );
  return createWorkspaceLiveSourceI18nMock();
});
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", async () => {
  const { createWorkspaceLiveSourceDirectoryMock } = await import(
    "./helpers/workspace-live-source-harness"
  );
  return createWorkspaceLiveSourceDirectoryMock();
});

import WorkspaceLoading from "../apps/web/src/app/workspace/loading";
import WorkspacePage from "../apps/web/src/app/workspace/page";
import {
  installWorkspaceLiveSourceHooks,
  workspaceLiveSourceRepos as repos,
  workspaceLiveSourceState as state,
} from "./helpers/workspace-live-source-harness";

describe("workspace live library and guest surfaces", () => {
  const dictionary = getDictionary("en");
  installWorkspaceLiveSourceHooks();

  it("loads a bounded preview of already authorized library entries", async () => {
    repos.library.mockResolvedValue({
      items: [
        {
          resourceId: "prd_free",
          addedAt: new Date("2026-01-01T00:00:00.000Z"),
          downloadable: true,
          title: "Free Resource",
          slug: "free-resource",
          version: "1.0.0",
        },
      ],
      counts: { all: 36, ready: 35, unavailable: 1 },
      page: 1,
      pageSize: 4,
      total: 36,
      totalPages: 9,
    });

    const html = renderToStaticMarkup(await WorkspacePage());

    expect(repos.library).toHaveBeenCalledWith("usr_workspace", 1, "all", 4);
    expect(html).toContain("Free Resource");
    expect(html).toContain("/market/free-resource");
    expect(html).toContain("/workspace/library");
    expect(html).toContain(">36<");
  });

  it("never exposes unpublished resource details in a private library preview", async () => {
    repos.library.mockResolvedValue({
      items: [
        {
          resourceId: "prd_private",
          addedAt: new Date("2026-01-01T00:00:00.000Z"),
          downloadable: false,
          title: null,
          slug: null,
          version: null,
        },
      ],
      counts: { all: 1, ready: 0, unavailable: 1 },
      page: 1,
      pageSize: 4,
      total: 1,
      totalPages: 1,
    });
    const html = renderToStaticMarkup(await WorkspacePage());
    expect(html).toContain("Resource temporarily unavailable");
    expect(html).not.toContain("prd_private");
    expect(html).not.toContain("/market/undefined");
  });

  it("routes guests through login with a workspace return path", async () => {
    state.user = null;
    const html = renderToStaticMarkup(await WorkspacePage());
    expect(html).toContain('href="/auth/login?next=%2Fworkspace"');
    expect(repos.library).not.toHaveBeenCalled();
    expect(repos.managedServers).not.toHaveBeenCalled();
  });

  it("shows ErrorState retry when the library preview fails", async () => {
    repos.library.mockRejectedValue(new Error("library-secret"));
    const html = renderToStaticMarkup(await WorkspacePage());
    expect(html).toContain('role="alert"');
    expect(html).toContain(dictionary.workspace.libraryUnavailable);
    expect(html).toContain(dictionary.errors.retry);
    expect(html).toContain('href="/workspace"');
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
    expect(html).toContain(dictionary.workspace.noServers);
    expect(html).not.toContain("library-secret");
    expect(html).not.toContain(dictionary.workspace.emptyLibrary);
  });

  it.each(["en", "ru"] as const)(
    "renders an honest workspace loading shell with clipped overflow in %s",
    async (locale) => {
      const { getRequestLocale } = await import("../apps/web/src/lib/i18n-server");
      vi.mocked(getRequestLocale).mockResolvedValueOnce(locale);
      const copy = getDictionary(locale).workspace;
      const html = renderToStaticMarkup(await WorkspaceLoading());
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('id="workspace-loading-heading"');
      expect(html).toContain(`>${copy.title}<`);
      expect(html).toContain(copy.loading);
      expect(html).toContain("overflow-x-clip");
      expect(html).toContain("min-w-0");
    },
  );

  it("keeps RU/EN workspace hub empty and unavailable copy distinct", () => {
    const en = getDictionary("en").workspace;
    const ru = getDictionary("ru").workspace;
    expect(en.emptyLibrary).not.toBe(ru.emptyLibrary);
    expect(en.emptyLibraryHint).not.toBe(ru.emptyLibraryHint);
    expect(en.noServers).not.toBe(ru.noServers);
    expect(en.noServersHint).not.toBe(ru.noServersHint);
    expect(en.libraryUnavailable).not.toBe(ru.libraryUnavailable);
    expect(en.serversUnavailable).not.toBe(ru.serversUnavailable);
    expect(en.emptyLibraryHint.length).toBeGreaterThan(0);
    expect(en.noServersHint.length).toBeGreaterThan(0);
  });
});
