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

import WorkspacePage from "../apps/web/src/app/workspace/page";
import {
  installWorkspaceLiveSourceHooks,
  workspaceLiveSourceRepos as repos,
} from "./helpers/workspace-live-source-harness";

describe("workspace live telemetry behavior", () => {
  const dictionary = getDictionary("en");
  installWorkspaceLiveSourceHooks();

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
});
