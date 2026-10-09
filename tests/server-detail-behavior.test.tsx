import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const state = vi.hoisted(() => ({
  server: {
    id: "srv_detail",
    slug: "detail-server",
    name: "Detail Server",
    description: "Server description",
    ipAddress: "203.0.113.50",
    port: 22003,
    status: "active",
    visibility: "public",
    isVerified: false,
    ownerId: null as string | null,
    organizationId: null,
    gameplayTags: [],
    mediaUrls: [],
    maxPlayers: 64,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  },
  notFoundCalls: 0,
}));

const mocks = vi.hoisted(() => ({
  getServer: vi.fn(),
  directory: vi.fn(),
  history: vi.fn(),
  updates: vi.fn(),
  matches: vi.fn(),
  liveStatus: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    state.notFoundCalls += 1;
    throw new Error("NEXT_NOT_FOUND");
  },
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
      children: ReactNode;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("@nexus/ui", async () => {
  const React = await import("react");
  return {
    TrustBadge: ({ label }: { label: string }) =>
      React.createElement("span", { "data-testid": "trust-badge" }, label),
  };
});

vi.mock("../apps/web/src/lib/services/server-service", () => ({
  serverService: {
    getServerBySlug: mocks.getServer,
  },
}));

vi.mock("../apps/web/src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: {
    getDirectory: mocks.directory,
  },
  matchesMtaEndpoint: mocks.matches,
  mtaLiveStatus: mocks.liveStatus,
}));

vi.mock("../apps/web/src/lib/services/server-history-service", () => ({
  serverHistoryService: {
    getHistoryForServer: mocks.history,
  },
}));

vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: {
    listServerUpdates: mocks.updates,
  },
}));

vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));

vi.mock("../apps/web/src/components/server-follow-button", async () => {
  const React = await import("react");
  return {
    ServerFollowButton: ({ serverId, serverName }: { serverId: string; serverName: string }) =>
      React.createElement(
        "div",
        {
          "data-testid": "server-follow",
          "data-server-id": serverId,
        },
        serverName,
      ),
  };
});

vi.mock("../apps/web/src/components/server-history-panel", async () => {
  const React = await import("react");
  return {
    ServerHistoryPanel: ({ history, locale }: { history: unknown; locale: string }) =>
      React.createElement("div", {
        "data-testid": "server-history",
        "data-locale": locale,
        "data-has-history": history ? "true" : "false",
      }),
  };
});

vi.mock("../apps/web/src/components/server-updates-panel", async () => {
  const React = await import("react");
  return {
    ServerUpdatesPanel: ({ updates }: { updates: unknown }) =>
      React.createElement("div", {
        "data-testid": "server-updates",
        "data-has-updates": updates ? "true" : "false",
      }),
  };
});

vi.mock("../apps/web/src/components/server-claim-control-panel", async () => {
  const React = await import("react");
  return {
    ServerClaimControlPanel: ({ serverId }: { serverId: string }) =>
      React.createElement("div", {
        "data-testid": "server-claim",
        "data-server-id": serverId,
      }),
  };
});

import ServerDetailPage from "../apps/web/src/app/servers/[slug]/page";

describe("server detail behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.notFoundCalls = 0;
    state.server = {
      ...state.server,
      visibility: "public",
      isVerified: false,
      ownerId: null,
    };
    mocks.getServer.mockResolvedValue(state.server);
    mocks.matches.mockReturnValue(true);
    mocks.liveStatus.mockReturnValue("online");
  });

  it("starts live directory, stored history and server updates together", async () => {
    const directory = deferred<{
      isStale: boolean;
      servers: Array<Record<string, unknown>>;
    }>();
    const history = deferred<Record<string, unknown>>();
    const updates = deferred<Array<Record<string, unknown>>>();
    const observed = {
      address: state.server.ipAddress,
      port: state.server.port,
      players: 12,
      maxPlayers: 64,
      responding: true,
    };

    mocks.directory.mockReturnValue(directory.promise);
    mocks.history.mockReturnValue(history.promise);
    mocks.updates.mockReturnValue(updates.promise);

    const rendering = ServerDetailPage({
      params: Promise.resolve({ slug: state.server.slug }),
    });

    await vi.waitFor(() => {
      expect(mocks.directory).toHaveBeenCalledOnce();
      expect(mocks.history).toHaveBeenCalledWith(state.server, "24h");
      expect(mocks.updates).toHaveBeenCalledWith(state.server.id, 6);
    });

    directory.resolve({ isStale: false, servers: [observed] });
    history.resolve({ observations: [], summary: {} });
    updates.resolve([]);

    const html = renderToStaticMarkup(await rendering);

    expect(mocks.matches).toHaveBeenCalledWith(state.server, observed);
    expect(mocks.liveStatus).toHaveBeenCalledWith(observed, false);
    expect(html).toContain('data-testid="server-history"');
    expect(html).toContain('data-testid="server-updates"');
    expect(html).toContain('data-testid="server-follow"');
    expect(html).toContain('data-server-id="srv_detail"');
    expect(html).toContain('href="mtasa://203.0.113.50:22003"');
    expect(html).toContain('data-testid="server-claim"');
    expect(html).toContain(">12 <");
  });

  it("hides claim controls for a verified server", async () => {
    state.server = {
      ...state.server,
      isVerified: true,
      ownerId: "usr_owner",
    };
    mocks.getServer.mockResolvedValue(state.server);
    mocks.directory.mockResolvedValue({ isStale: false, servers: [] });
    mocks.history.mockResolvedValue(null);
    mocks.updates.mockResolvedValue([]);

    const html = renderToStaticMarkup(
      await ServerDetailPage({
        params: Promise.resolve({ slug: state.server.slug }),
      }),
    );

    expect(html).toContain('data-testid="server-follow"');
    expect(html).toContain('data-testid="server-history"');
    expect(html).not.toContain('data-testid="server-claim"');
  });

  it.each([
    ["7d", "7d"],
    ["30d", "30d"],
    ["invalid", "24h"],
    [["7d", "30d"], "24h"],
  ] as const)(
    "uses the requested history period %s during server rendering",
    async (history, expected) => {
      mocks.directory.mockResolvedValue({ isStale: false, servers: [] });
      mocks.history.mockResolvedValue(null);
      mocks.updates.mockResolvedValue([]);

      await ServerDetailPage({
        params: Promise.resolve({ slug: state.server.slug }),
        searchParams: Promise.resolve({
          history: typeof history === "string" ? history : [...history],
        }),
      });

      expect(mocks.history).toHaveBeenCalledExactlyOnceWith(state.server, expected);
    },
  );

  it("fails closed for private listings", async () => {
    mocks.getServer.mockResolvedValue({
      ...state.server,
      visibility: "private",
    });

    await expect(
      ServerDetailPage({
        params: Promise.resolve({ slug: state.server.slug }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.directory).not.toHaveBeenCalled();
    expect(mocks.history).not.toHaveBeenCalled();
    expect(state.notFoundCalls).toBe(1);
  });
});
