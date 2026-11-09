import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../../apps/web/src/lib/i18n";

const state = vi.hoisted(() => ({
  user: {
    id: "usr_workspace",
    username: "workspace-user",
    role: "user",
  } as null | { id: string; username: string; role: string },
}));

const repos = vi.hoisted(() => ({
  library: vi.fn(),
  managedServers: vi.fn(),
  directory: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "nexus_session" && state.user ? { value: "session-token" } : undefined,
  })),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace",
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      className,
    }: {
      href: string;
      children: ReactNode;
      className?: string;
    }) => React.createElement("a", { href, className }, children),
  };
});

vi.mock("@nexus/db", () => ({
  userLibraryRepository: { pageByUser: repos.library },
  serverRepository: { pageManagedByUser: repos.managedServers },
}));

vi.mock("../../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
  },
}));

vi.mock("../../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));

vi.mock("../../apps/web/src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: {
    getDirectory: repos.directory,
  },
  indexMtaObservations: vi.fn(
    (observations: Array<Record<string, unknown>>) => (server: { id: string }) =>
      observations.find((observation) => observation.serverId === server.id) ?? null,
  ),
  mtaLiveStatus: vi.fn((observation: null | { liveStatus?: string }, stale: boolean) =>
    stale ? "unknown" : (observation?.liveStatus ?? "unknown"),
  ),
}));

import WorkspaceLoading from "../../apps/web/src/app/workspace/loading";
import WorkspacePage from "../../apps/web/src/app/workspace/page";

describe("workspace live telemetry behavior", () => {
  const dictionary = getDictionary("en");

  beforeEach(() => {
    vi.clearAllMocks();
    state.user = {
      id: "usr_workspace",
      username: "workspace-user",
      role: "user",
    };
    repos.library.mockResolvedValue({
      items: [],
      counts: { all: 0, ready: 0, unavailable: 0 },
      page: 1,
      pageSize: 4,
      total: 0,
      totalPages: 1,
    });
    repos.managedServers.mockResolvedValue({
      servers: [],
      total: 0,
      page: 1,
      pageSize: 4,
      totalPages: 1,
    });
    repos.directory.mockResolvedValue({
      servers: [],
      isStale: false,
    });
  });

  it("does not contact the MTA directory when the user owns no servers", async () => {
    const html = renderToStaticMarkup(await WorkspacePage());

    expect(repos.managedServers).toHaveBeenCalledWith("usr_workspace", 1, {}, 4);
    expect(repos.directory).not.toHaveBeenCalled();
    expect(html).toContain(dictionary.workspace.liveUnavailable);
    expect(html).toContain(dictionary.workspace.noServers);
    expect(html).toContain(dictionary.workspace.noServersHint);
    expect(html).toContain(dictionary.workspace.emptyLibrary);
    expect(html).toContain(dictionary.workspace.emptyLibraryHint);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
    expect(html).toContain("min-h-11");
    expect(html).toContain('href="/workspace/library"');
    expect(html).toContain('href="/workspace/servers/new"');
    expect(html).toContain(dictionary.workspace.libraryTitle);
  });

  it("renders fresh official-directory observations as live workspace state", async () => {
    repos.managedServers.mockResolvedValue({
      servers: [
        {
          id: "srv_workspace",
          slug: "workspace-server",
          name: "Workspace Server",
          ipAddress: "198.51.100.50",
          port: 22003,
          visibility: "public",
          status: "active",
          isVerified: true,
          organizationId: null,
          updatedAt: new Date("2026-10-09T12:00:00Z"),
        },
      ],
      total: 125,
      page: 1,
      pageSize: 4,
      totalPages: 32,
    });
    repos.directory.mockResolvedValue({
      isStale: false,
      servers: [
        {
          serverId: "srv_workspace",
          liveStatus: "online",
          players: 17,
        },
      ],
    });

    const html = renderToStaticMarkup(await WorkspacePage());

    expect(repos.directory).toHaveBeenCalledOnce();
    expect(html).toContain("Workspace Server");
    expect(html).toContain(dictionary.servers.online);
    expect(html).toContain(">17<");
    expect(html).toContain("/workspace/servers/srv_workspace");
    expect(html).toContain(">125<");
    expect(html).toContain("On the displayed servers");
  });

  it("keeps unavailable directory observations neutral instead of inventing offline state", async () => {
    repos.managedServers.mockResolvedValue({
      servers: [
        {
          id: "srv_unknown",
          slug: "unknown-server",
          name: "Unknown Server",
          ipAddress: "198.51.100.51",
          port: 22003,
          visibility: "private",
          status: "active",
          isVerified: false,
          organizationId: null,
          updatedAt: new Date("2026-10-09T12:00:00Z"),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 4,
      totalPages: 1,
    });
    repos.directory.mockRejectedValue(new Error("directory unavailable"));

    const html = renderToStaticMarkup(await WorkspacePage());

    expect(html).toContain(dictionary.servers.unknown);
    expect(html).not.toContain(dictionary.servers.offline);
    expect(html).toContain("—");
    expect(html).not.toContain('href="/servers/unknown-server"');
  });

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

  it("starts directory lookup without waiting for the independent library read", async () => {
    let resolveLibrary!: (value: unknown) => void;
    repos.library.mockReturnValue(
      new Promise((resolve) => {
        resolveLibrary = resolve;
      }),
    );
    repos.managedServers.mockResolvedValue({
      servers: [
        {
          id: "srv_overlap",
          slug: "overlap",
          name: "Overlap",
          ipAddress: "203.0.113.10",
          port: 22003,
          visibility: "public",
          status: "active",
          isVerified: false,
          organizationId: null,
          updatedAt: new Date("2026-10-09T12:00:00Z"),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 4,
      totalPages: 1,
    });
    const rendering = WorkspacePage();
    await vi.waitFor(() => {
      expect(repos.directory).toHaveBeenCalledOnce();
    });
    resolveLibrary({ items: [], counts: { all: 0, ready: 0, unavailable: 0 } });
    expect(renderToStaticMarkup(await rendering)).toContain("Overlap");
  });

  it("keeps the player total unknown when a displayed online server has no count", async () => {
    repos.managedServers.mockResolvedValue({
      servers: [
        {
          id: "srv_unknown_count",
          slug: "unknown-count",
          name: "Unknown count",
          ipAddress: "203.0.113.10",
          port: 22003,
          visibility: "public",
          status: "active",
          isVerified: false,
          organizationId: null,
          updatedAt: new Date("2026-10-09T12:00:00Z"),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 4,
      totalPages: 1,
    });
    repos.directory.mockResolvedValue({
      isStale: false,
      servers: [{ serverId: "srv_unknown_count", liveStatus: "online" }],
    });
    const html = renderToStaticMarkup(await WorkspacePage());
    expect(html).toContain(dictionary.servers.online);
    expect(html).toContain("—");
    expect(html).toContain("On the displayed servers");
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

  it("shows ErrorState retry when the managed servers preview fails", async () => {
    repos.managedServers.mockRejectedValue(new Error("servers-secret"));
    const html = renderToStaticMarkup(await WorkspacePage());
    expect(html).toContain('role="alert"');
    expect(html).toContain(dictionary.workspace.serversUnavailable);
    expect(html).toContain(dictionary.errors.retry);
    expect(html).toContain('href="/workspace"');
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
    expect(html).toContain(dictionary.workspace.emptyLibrary);
    expect(html).not.toContain("servers-secret");
    expect(html).not.toContain(dictionary.workspace.noServers);
    expect(repos.directory).not.toHaveBeenCalled();
  });

  it.each(["en", "ru"] as const)(
    "renders an honest workspace loading shell with clipped overflow in %s",
    async (locale) => {
      const { getRequestLocale } = await import("../../apps/web/src/lib/i18n-server");
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
