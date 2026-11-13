import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { flattenReactTestTree } from "./helpers/flatten-react-test-tree";
import { mocks, setupServerDetailBehavior, state } from "./helpers/server-detail-behavior-harness";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../site/src/lib/services/auth-service", async () => {
  const { mocks: harnessMocks } = await import("./helpers/server-detail-behavior-harness");
  return {
    authService: { getSession: harnessMocks.session },
  };
});

vi.mock("next/navigation", async () => {
  const { state: harnessState } = await import("./helpers/server-detail-behavior-harness");
  return {
    notFound: () => {
      harnessState.notFoundCalls += 1;
      throw new Error("NEXT_NOT_FOUND");
    },
  };
});

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
    ErrorState: ({ id, title }: { id?: string; title: string }) =>
      React.createElement("div", { id, role: "alert" }, title),
  };
});

vi.mock("../site/src/lib/services/server-service", async () => {
  const { mocks: harnessMocks } = await import("./helpers/server-detail-behavior-harness");
  return {
    serverService: {
      getServerBySlug: harnessMocks.getServer,
    },
  };
});

vi.mock("../site/src/lib/services/mta-master-directory-service", async () => {
  const { mocks: harnessMocks } = await import("./helpers/server-detail-behavior-harness");
  return {
    mtaMasterDirectoryService: {
      getDirectory: harnessMocks.directory,
    },
    matchesMtaEndpoint: harnessMocks.matches,
    mtaLiveStatus: harnessMocks.liveStatus,
  };
});

vi.mock("../site/src/lib/services/server-history-service", async () => {
  const { mocks: harnessMocks } = await import("./helpers/server-detail-behavior-harness");
  return {
    serverHistoryService: {
      getHistoryForServer: harnessMocks.history,
    },
  };
});

vi.mock("../site/src/lib/services/content-service", async () => {
  const { mocks: harnessMocks } = await import("./helpers/server-detail-behavior-harness");
  return {
    contentService: {
      listServerUpdates: harnessMocks.updates,
    },
  };
});

vi.mock("../site/src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
  getRequestCookieStore: vi.fn(async () => ({ get: () => ({ value: "session" }) })),
}));

vi.mock("../site/src/components/server-follow-button", async () => {
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

vi.mock("../site/src/components/server-history-panel", async () => {
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

vi.mock("../site/src/components/server-updates-panel", async () => {
  const React = await import("react");
  return {
    ServerUpdatesPanel: ({ updates }: { updates: unknown }) =>
      React.createElement("div", {
        "data-testid": "server-updates",
        "data-has-updates": updates ? "true" : "false",
      }),
  };
});

vi.mock("../site/src/components/server-claim-control-panel", async () => {
  const React = await import("react");
  return {
    ServerClaimControlPanel: ({ serverId }: { serverId: string }) =>
      React.createElement("div", {
        "data-testid": "server-claim",
        "data-server-id": serverId,
      }),
  };
});

vi.mock("../site/src/components/server-connect-controls", async () => {
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

vi.mock("../site/src/components/server-review-panel", async () => {
  const React = await import("react");
  return {
    ServerReviewPanel: ({ serverId }: { serverId: string }) =>
      React.createElement("div", {
        "data-testid": "server-reviews",
        "data-server-id": serverId,
      }),
  };
});

vi.mock("../site/src/lib/services/server-review-service", () => ({
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

import ServerDetailPage from "../site/src/app/servers/[slug]/page";

setupServerDetailBehavior();

describe("server detail claim session controls", () => {
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
