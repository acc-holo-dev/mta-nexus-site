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
}));

vi.mock("../../../components/server-follow-button", async () => {
  const React = await import("react");
  return {
    ServerFollowButton: () => React.createElement("div", { "data-testid": "server-follow" }),
  };
});

vi.mock("../../../components/server-history-panel", async () => {
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

vi.mock("../../../components/server-claim-control-panel", async () => {
  const React = await import("react");
  return {
    ServerClaimControlPanel: () => React.createElement("div", { "data-testid": "server-claim" }),
  };
});

vi.mock("../../../components/server-connect-controls", async () => {
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
    mocks.getServer.mockResolvedValue(state.server);
    mocks.directory.mockResolvedValue({ isStale: false, servers: [] });
    mocks.history.mockResolvedValue(null);
    mocks.updates.mockResolvedValue([]);
    mocks.matches.mockReturnValue(false);
    mocks.liveStatus.mockReturnValue("unknown");
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
