import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { flattenReactTestTree } from "./helpers/flatten-react-test-tree";

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
    organizationId: null as string | null,
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
  session: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
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
  getRequestCookieStore: vi.fn(async () => ({ get: () => ({ value: "session" }) })),
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

vi.mock("../apps/web/src/components/server-connect-controls", async () => {
  const React = await import("react");
  return {
    ServerConnectControls: ({
      address,
      connectUri,
      connectLabel,
      connectHint,
    }: {
      address: string;
      connectUri: string;
      connectLabel: string;
      connectHint?: string;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "server-connect" },
        React.createElement("a", { href: connectUri }, connectLabel),
        React.createElement("span", null, address),
        connectHint ? React.createElement("p", null, connectHint) : null,
      ),
  };
});

vi.mock("../apps/web/src/components/server-review-panel", async () => {
  const React = await import("react");
  return {
    ServerReviewPanel: ({ serverId }: { serverId: string }) =>
      React.createElement("div", {
        "data-testid": "server-reviews",
        "data-server-id": serverId,
      }),
  };
});

vi.mock("../apps/web/src/lib/services/server-review-service", () => ({
  serverReviewService: {
    publicPage: vi.fn(async () => ({
      reviews: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    })),
  },
}));

import ServerDetailPage from "../apps/web/src/app/servers/[slug]/page";

describe("server detail behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.notFoundCalls = 0;
    mocks.session.mockResolvedValue(null);
    state.server = {
      ...state.server,
      visibility: "public",
      isVerified: false,
      ownerId: null,
      organizationId: null,
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
    expect(html).toContain("Open in MTA");
    expect(html).toContain("connect intent");
    expect(html).not.toMatch(/verified play|verified-play/iu);
    expect(html).toContain('data-testid="server-claim"');
    expect(html).toContain(">12 <");
  });

  it("keeps unknown live occupancy distinct from a fabricated zero fill", async () => {
    mocks.directory.mockResolvedValue({ isStale: false, servers: [] });
    mocks.history.mockResolvedValue(null);
    mocks.updates.mockResolvedValue([]);
    mocks.matches.mockReturnValue(false);
    mocks.liveStatus.mockReturnValue("unknown");

    const html = renderToStaticMarkup(
      await ServerDetailPage({
        params: Promise.resolve({ slug: state.server.slug }),
      }),
    );

    expect(html).toMatch(/>—\s*</u);
    expect(html).toContain('style="width:0%"');
    expect(html).toContain("Open in MTA");
    expect(html).toContain("203.0.113.50:22003");
    expect(html).not.toMatch(/>0\s*<span[^>]*>\/ 64</u);
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

  it("does not offer public personal ownership claims for an organization server", async () => {
    state.server = { ...state.server, organizationId: "org_1", ownerId: null, isVerified: false };
    mocks.getServer.mockResolvedValue(state.server);
    mocks.directory.mockResolvedValue({ isStale: false, servers: [] });
    mocks.history.mockResolvedValue(null);
    mocks.updates.mockResolvedValue([]);
    const html = renderToStaticMarkup(
      await ServerDetailPage({ params: Promise.resolve({ slug: state.server.slug }) }),
    );
    expect(html).not.toContain('data-testid="server-claim"');
  });
  it("changes the public claim component key and actor on account refresh", async () => {
    mocks.directory.mockResolvedValue({ isStale: false, servers: [] });
    mocks.history.mockResolvedValue(null);
    mocks.updates.mockResolvedValue([]);
    mocks.session.mockResolvedValue({ id: "usr_a" });
    const pageA = await ServerDetailPage({ params: Promise.resolve({ slug: state.server.slug }) });
    const claimA = flattenReactTestTree(pageA).find(
      (node) => node.props.expectedActorId === "usr_a",
    );
    mocks.session.mockResolvedValue({ id: "usr_b" });
    const pageB = await ServerDetailPage({ params: Promise.resolve({ slug: state.server.slug }) });
    const claimB = flattenReactTestTree(pageB).find(
      (node) => node.props.expectedActorId === "usr_b",
    );
    expect(claimA).toBeDefined();
    expect(claimB).toBeDefined();
    expect(claimA?.key).not.toBe(claimB?.key);
  });
  it("shows an unavailable state when the claim session lookup fails", async () => {
    mocks.directory.mockResolvedValue({ isStale: false, servers: [] });
    mocks.history.mockResolvedValue(null);
    mocks.updates.mockResolvedValue([]);
    mocks.session.mockRejectedValueOnce(new Error("session store unavailable"));
    const html = renderToStaticMarkup(
      await ServerDetailPage({ params: Promise.resolve({ slug: state.server.slug }) }),
    );
    expect(html).toContain("Could not check the session for server verification.");
    expect(html).not.toContain('data-testid="server-claim"');
  });
});
