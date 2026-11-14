import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
}));

const mocks = vi.hoisted(() => ({
  getServer: vi.fn(),
  directory: vi.fn(),
  history: vi.fn(),
  updates: vi.fn(),
  publicPage: vi.fn(),
  matches: vi.fn(),
  liveStatus: vi.fn(),
  reviewProps: [] as Array<Record<string, unknown>>,
  session: vi.fn(),
  followStates: vi.fn(async (): Promise<string[]> => []),
  muteState: vi.fn(async () => ({ muted: false, mutedUntil: null as string | null })),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../../../lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
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
    Button: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) =>
      React.createElement("button", props, children),
    ErrorState: ({ title }: { title: string }) =>
      React.createElement("div", { role: "alert" }, title),
  };
});

vi.mock("../../../components/object-report-form", async () => {
  const React = await import("react");
  return {
    ObjectReportForm: () => React.createElement("div", { "data-testid": "object-report" }),
  };
});

vi.mock("../../../lib/services/server-service", () => ({
  serverService: { getServerBySlug: mocks.getServer },
}));

vi.mock("../../../lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: { getDirectory: mocks.directory },
  matchesMtaEndpoint: mocks.matches,
  mtaLiveStatus: mocks.liveStatus,
}));

vi.mock("../../../lib/services/server-history-service", () => ({
  serverHistoryService: { getHistoryForServer: mocks.history },
}));

vi.mock("../../../lib/services/content-service", () => ({
  contentService: { listServerUpdates: mocks.updates },
}));

vi.mock("../../../lib/services/server-review-service", () => ({
  serverReviewService: { publicPage: mocks.publicPage },
}));

vi.mock("../../../lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
  getRequestCookieStore: vi.fn(async () => ({ get: () => ({ value: "session" }) })),
}));

vi.mock("@nexus/db", () => ({
  followWorkspaceRepository: {
    states: mocks.followStates,
    muteState: mocks.muteState,
  },
}));

vi.mock("../../../components/server-follow-button", async () => {
  const React = await import("react");
  return {
    ServerFollowButton: ({ initial }: { initial?: unknown }) =>
      React.createElement("div", {
        "data-testid": "server-follow",
        "data-follow-initial": JSON.stringify(initial ?? null),
      }),
  };
});

vi.mock("../../../features/servers/history-server", async () => {
  const React = await import("react");
  return {
    ServerHistoryPanel: () => React.createElement("div", { "data-testid": "server-history" }),
  };
});

vi.mock("../../../components/server-updates-panel", async () => {
  const React = await import("react");
  return {
    ServerUpdatesPanel: ({ updates }: { updates: unknown }) =>
      React.createElement("div", {
        "data-testid": "server-updates",
        "data-has-updates": updates ? "true" : "false",
      }),
  };
});

vi.mock("../../../features/servers/claim-controls", async () => {
  const React = await import("react");
  return {
    ServerClaimControlPanel: () => React.createElement("div", { "data-testid": "server-claim" }),
  };
});

vi.mock("../../../features/servers/connect", async () => {
  const React = await import("react");
  return {
    ServerConnectControls: ({
      connectUri,
      connectLabel,
    }: {
      connectUri: string;
      connectLabel: string;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "server-connect" },
        React.createElement("a", { href: connectUri }, connectLabel),
      ),
  };
});

vi.mock("../../../components/server-review-panel", async () => {
  const React = await import("react");
  return {
    ServerReviewPanel: (props: Record<string, unknown>) => {
      mocks.reviewProps.push(props);
      return React.createElement("div", {
        "data-testid": "server-reviews",
        "data-load-state": String(props.loadState ?? "ready"),
        "data-total":
          props.initialPage && typeof props.initialPage === "object"
            ? String((props.initialPage as { total?: number }).total ?? "")
            : "",
      });
    },
  };
});

import ServerDetailPage from "./page";

describe("server detail review load honesty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reviewProps.length = 0;
    mocks.session.mockResolvedValue(null);
    mocks.followStates.mockResolvedValue([]);
    mocks.muteState.mockResolvedValue({ muted: false, mutedUntil: null });
    mocks.getServer.mockResolvedValue(state.server);
    mocks.directory.mockResolvedValue({ isStale: false, servers: [] });
    mocks.history.mockResolvedValue(null);
    mocks.updates.mockResolvedValue([]);
    mocks.matches.mockReturnValue(false);
    mocks.liveStatus.mockReturnValue("unknown");
    mocks.publicPage.mockResolvedValue({
      reviews: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
  });

  it("SSR-hydrates guest follow controls without querying mute state", async () => {
    const html = renderToStaticMarkup(
      await ServerDetailPage({ params: Promise.resolve({ slug: state.server.slug }) }),
    );
    expect(mocks.followStates).not.toHaveBeenCalled();
    expect(mocks.muteState).not.toHaveBeenCalled();
    expect(html).toContain(
      'data-follow-initial="{&quot;authenticated&quot;:false,&quot;actorId&quot;:null,&quot;following&quot;:false,&quot;muted&quot;:false,&quot;mutedUntil&quot;:null}"',
    );
  });

  it("SSR-hydrates authenticated server follow and mute", async () => {
    mocks.session.mockResolvedValue({ id: "usr_a", role: "user" });
    mocks.followStates.mockResolvedValue(["srv_detail"]);
    mocks.muteState.mockResolvedValue({
      muted: true,
      mutedUntil: "2026-12-01T00:00:00.000Z",
    });
    const html = renderToStaticMarkup(
      await ServerDetailPage({ params: Promise.resolve({ slug: state.server.slug }) }),
    );
    expect(mocks.followStates).toHaveBeenCalledWith("usr_a", "server", ["srv_detail"]);
    expect(mocks.muteState).toHaveBeenCalledWith("usr_a", "server", "srv_detail");
    expect(html).toContain("&quot;authenticated&quot;:true");
    expect(html).toContain("&quot;following&quot;:true");
    expect(html).toContain("&quot;muted&quot;:true");
    expect(html).toContain("2026-12-01T00:00:00.000Z");
  });

  it("passes unavailable instead of fabricating total=0 when publicPage rejects", async () => {
    mocks.publicPage.mockRejectedValueOnce(new Error("review store down"));

    const html = renderToStaticMarkup(
      await ServerDetailPage({ params: Promise.resolve({ slug: state.server.slug }) }),
    );

    expect(html).toContain('data-testid="server-reviews"');
    expect(html).toContain('data-load-state="unavailable"');
    expect(html).toContain('data-testid="server-history"');
    expect(html).toContain('data-testid="server-updates"');
    expect(mocks.reviewProps[0]).toMatchObject({
      serverId: state.server.id,
      loadState: "unavailable",
    });
    expect(mocks.reviewProps[0]?.initialPage).toBeUndefined();
  });

  it("keeps a successful empty page as total=0 empty state", async () => {
    mocks.publicPage.mockResolvedValueOnce({
      reviews: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    const html = renderToStaticMarkup(
      await ServerDetailPage({ params: Promise.resolve({ slug: state.server.slug }) }),
    );

    expect(html).toContain('data-load-state="ready"');
    expect(html).toContain('data-total="0"');
    expect(mocks.reviewProps[0]).toMatchObject({
      serverId: state.server.id,
      initialPage: expect.objectContaining({ total: 0, reviews: [] }),
    });
  });

  it("forwards nonempty review pages unchanged", async () => {
    mocks.publicPage.mockResolvedValueOnce({
      reviews: [{ id: "cmt_1" }],
      total: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    const html = renderToStaticMarkup(
      await ServerDetailPage({ params: Promise.resolve({ slug: state.server.slug }) }),
    );

    expect(html).toContain('data-total="3"');
    expect(mocks.reviewProps[0]).toMatchObject({
      initialPage: expect.objectContaining({ total: 3 }),
    });
  });
});
