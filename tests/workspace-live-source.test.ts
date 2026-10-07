import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

const state = vi.hoisted(() => ({
  user: {
    id: "usr_workspace",
    username: "workspace-user",
    role: "user",
  } as null | { id: string; username: string; role: string },
}));

const repos = vi.hoisted(() => ({
  entitlements: vi.fn(),
  licenses: vi.fn(),
  products: vi.fn(),
  ownedServers: vi.fn(),
  directory: vi.fn(),
  collectLibrary: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "nexus_session" && state.user
        ? { value: "session-token" }
        : undefined,
  })),
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children: React.ReactNode;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("@nexus/db", () => ({
  entitlementRepository: { listBySubject: repos.entitlements },
  licenseRepository: { listActiveDownloadableByUser: repos.licenses },
  productRepository: { listPublishedFreeByIds: repos.products },
  serverRepository: { listByOwner: repos.ownedServers },
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
  },
}));

vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));

vi.mock("../apps/web/src/lib/user-library", () => ({
  collectLibraryEntries: repos.collectLibrary,
}));

vi.mock(
  "../apps/web/src/lib/services/mta-master-directory-service",
  () => ({
    mtaMasterDirectoryService: {
      getDirectory: repos.directory,
    },
    indexMtaObservations: vi.fn(
      (observations: Array<Record<string, unknown>>) =>
        (server: { id: string }) =>
          observations.find(
            (observation) => observation.serverId === server.id,
          ) ?? null,
    ),
    mtaLiveStatus: vi.fn(
      (
        observation: null | { liveStatus?: string },
        stale: boolean,
      ) => (stale ? "unknown" : observation?.liveStatus ?? "unknown"),
    ),
  }),
);

import WorkspacePage from "../apps/web/src/app/workspace/page";

describe("workspace live telemetry behavior", () => {
  const dictionary = getDictionary("en");

  beforeEach(() => {
    vi.clearAllMocks();
    state.user = {
      id: "usr_workspace",
      username: "workspace-user",
      role: "user",
    };
    repos.entitlements.mockResolvedValue([]);
    repos.licenses.mockResolvedValue([]);
    repos.products.mockResolvedValue([]);
    repos.ownedServers.mockResolvedValue([]);
    repos.directory.mockResolvedValue({
      servers: [],
      isStale: false,
    });
    repos.collectLibrary.mockReturnValue([]);
  });

  it("does not contact the MTA directory when the user owns no servers", async () => {
    const html = renderToStaticMarkup(await WorkspacePage());

    expect(repos.ownedServers).toHaveBeenCalledWith("usr_workspace");
    expect(repos.directory).not.toHaveBeenCalled();
    expect(html).toContain(dictionary.workspace.liveUnavailable);
    expect(html).toContain(dictionary.workspace.noServers);
  });

  it("renders fresh official-directory observations as live workspace state", async () => {
    repos.ownedServers.mockResolvedValue([
      {
        id: "srv_workspace",
        slug: "workspace-server",
        name: "Workspace Server",
        ipAddress: "198.51.100.50",
        port: 22003,
      },
    ]);
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
  });

  it("keeps unavailable directory observations neutral instead of inventing offline state", async () => {
    repos.ownedServers.mockResolvedValue([
      {
        id: "srv_unknown",
        slug: "unknown-server",
        name: "Unknown Server",
        ipAddress: "198.51.100.51",
        port: 22003,
      },
    ]);
    repos.directory.mockRejectedValue(new Error("directory unavailable"));

    const html = renderToStaticMarkup(await WorkspacePage());

    expect(html).toContain(dictionary.servers.unknown);
    expect(html).not.toContain(dictionary.servers.offline);
    expect(html).toContain("—");
  });

  it("loads library cards only from the collected entitlement compatibility set", async () => {
    const entitlement = {
      resourceId: "prd_free",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    repos.entitlements.mockResolvedValue([{ id: "ent_1" }]);
    repos.licenses.mockResolvedValue([{ id: "lic_legacy" }]);
    repos.collectLibrary.mockReturnValue([entitlement]);
    repos.products.mockResolvedValue([
      {
        id: "prd_free",
        slug: "free-resource",
        title: "Free Resource",
      },
    ]);

    const html = renderToStaticMarkup(await WorkspacePage());

    expect(repos.collectLibrary).toHaveBeenCalledWith(
      [{ id: "ent_1" }],
      [{ id: "lic_legacy" }],
    );
    expect(repos.products).toHaveBeenCalledWith(["prd_free"]);
    expect(html).toContain("Free Resource");
    expect(html).toContain("/market/free-resource");
  });
});
