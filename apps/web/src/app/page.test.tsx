import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  getDirectory: vi.fn(),
  listProducts: vi.fn(),
  listArticles: vi.fn(),
  listServers: vi.fn(),
  getSession: vi.fn(),
  loadPersonal: vi.fn(),
}));

vi.mock("@nexus/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nexus/ui")>();
  const React = await import("react");
  return {
    ...actual,
    SectionHeader: ({
      title,
      description,
      action,
    }: {
      title: string;
      description?: string;
      action?: React.ReactNode;
    }) =>
      React.createElement(
        "header",
        null,
        React.createElement("h2", null, title),
        description ? React.createElement("p", null, description) : null,
        action,
      ),
  };
});

vi.mock("../components/server-card", async () => {
  const React = await import("react");
  return {
    HomeNetworkServerCard: ({
      observation,
      profileSlug,
      isStale,
    }: {
      observation: {
        address: string;
        port: number;
        name?: string;
        players?: number;
        maxPlayers?: number;
      };
      profileSlug?: string;
      isStale?: boolean;
    }) =>
      React.createElement(
        "article",
        {
          "data-testid": "home-server-card",
          "data-players":
            isStale || observation.players == null ? "unknown" : String(observation.players),
          "data-profile": profileSlug ?? "",
        },
        observation.name,
        profileSlug
          ? React.createElement("a", { href: `/servers/${profileSlug}` }, "View")
          : null,
        React.createElement(
          "a",
          { href: `mtasa://${observation.address}:${observation.port}` },
          "Connect",
        ),
      ),
  };
});

vi.mock("../lib/i18n-server", () => ({
  getRequestLocale: async () => mocks.locale,
}));

vi.mock("../lib/services/mta-master-directory-service", async () => {
  const actual = await vi.importActual<
    typeof import("../lib/services/mta-master-directory-service")
  >("../lib/services/mta-master-directory-service");
  return {
    ...actual,
    mtaMasterDirectoryService: { getDirectory: mocks.getDirectory },
  };
});

vi.mock("../lib/services/product-service", () => ({
  productService: {
    listProducts: mocks.listProducts,
    getPublicAttributions: async () => new Map(),
  },
}));

vi.mock("../lib/services/content-service", () => ({
  contentService: { listArticles: mocks.listArticles },
}));

vi.mock("../lib/services/server-service", () => ({
  serverService: { listServers: mocks.listServers },
}));

vi.mock("../lib/services/auth-service", () => ({
  authService: { getSession: mocks.getSession },
}));

vi.mock("../lib/home-personal-changes", () => ({
  loadPersonalChangesSummary: mocks.loadPersonal,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

vi.mock("../components/product-card", () => ({
  ProductCard: ({ product }: { product: { title: string } }) =>
    createElement("article", null, product.title),
}));

vi.mock("../components/article-card", () => ({
  ArticleCard: ({ article }: { article: { title: string } }) =>
    createElement("article", null, article.title),
}));

import HomePage from "./page";

describe("home network honest player aggregates", () => {
  beforeEach(() => {
    mocks.locale = "en";
    mocks.listProducts.mockResolvedValue([]);
    mocks.listArticles.mockResolvedValue([]);
    mocks.listServers.mockResolvedValue([]);
    mocks.getSession.mockResolvedValue(null);
    mocks.loadPersonal.mockResolvedValue({ status: "empty", items: [], failedSources: [] });
  });

  it("does not treat unknown player counts as zero in the aggregate or cards", async () => {
    mocks.getDirectory.mockResolvedValueOnce({
      isStale: false,
      fetchedAt: "2026-11-01T00:00:00.000Z",
      servers: [
        { address: "203.0.113.10", port: 22003, name: "Known", players: 5, maxPlayers: 32 },
        { address: "203.0.113.11", port: 22003, name: "Unknown players", maxPlayers: 32 },
        { address: "203.0.113.12", port: 22003, name: "Empty", players: 0, maxPlayers: 16 },
      ],
    });

    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain("Players online: 5 · Player count unknown");
    expect(html).toContain('data-players="5"');
    expect(html).toContain('data-players="unknown"');
    expect(html).toContain('data-players="0"');
  });

  it("marks stale snapshots without inventing a live player total", async () => {
    mocks.getDirectory.mockResolvedValueOnce({
      isStale: true,
      fetchedAt: "2026-11-01T00:00:00.000Z",
      servers: [{ address: "203.0.113.10", port: 22003, name: "Stale", players: 9, maxPlayers: 32 }],
    });

    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain("Players online: —");
    expect(html).toContain("latest available snapshot");
    expect(html).toContain('data-players="unknown"');
  });

  it("links a NEXUS profile only for endpoint-matched listings", async () => {
    mocks.getDirectory.mockResolvedValueOnce({
      isStale: false,
      fetchedAt: "2026-11-01T00:00:00.000Z",
      servers: [
        { address: "203.0.113.20", port: 22003, name: "Mapped", players: 2, maxPlayers: 32 },
        { address: "203.0.113.21", port: 22003, name: "Unmapped", players: 4, maxPlayers: 32 },
      ],
    });
    mocks.listServers.mockResolvedValueOnce([
      {
        id: "srv_mapped",
        slug: "mapped-nexus",
        name: "Mapped NEXUS",
        ipAddress: "203.0.113.20",
        port: 22003,
      },
    ]);

    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain('data-profile="mapped-nexus"');
    expect(html).toContain('href="/servers/mapped-nexus"');
    expect(html).toContain('href="mtasa://203.0.113.21:22003"');
    expect(html).toContain('data-profile=""');
    expect(html).not.toContain('href="/servers/unmapped');
  });

  it("keeps personal changes off the guest Home and shows them for signed-in members", async () => {
    mocks.getDirectory.mockResolvedValueOnce({
      isStale: false,
      fetchedAt: "2026-11-01T00:00:00.000Z",
      servers: [],
    });

    const guest = renderToStaticMarkup(await HomePage());
    expect(guest).not.toContain("Your changes");
    expect(mocks.loadPersonal).not.toHaveBeenCalled();

    mocks.getSession.mockResolvedValueOnce({ id: "usr_1", username: "member" });
    mocks.loadPersonal.mockResolvedValueOnce({
      status: "ok",
      items: [
        {
          id: "n1",
          reason: "replyToMe",
          title: "Reply waiting",
          href: "/articles/a?comment=c#comment-c",
          createdAt: "2026-11-01T00:00:00.000000Z",
        },
      ],
      failedSources: [],
    });
    mocks.getDirectory.mockResolvedValueOnce({
      isStale: false,
      fetchedAt: "2026-11-01T00:00:00.000Z",
      servers: [],
    });

    const member = renderToStaticMarkup(await HomePage());
    expect(member).toContain("Your changes");
    expect(member).toContain("Unread reply to you");
    expect(member).toContain("Reply waiting");
    expect(member).toContain('href="/articles/a?comment=c#comment-c"');
    expect(member).toMatch(/Don(?:'|&#x27;)t show personal changes on Home/u);
  });
});
