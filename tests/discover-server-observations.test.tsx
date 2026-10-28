import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

const sources = vi.hoisted(() => ({
  servers: vi.fn(),
  search: vi.fn(),
  directory: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("@nexus/db", () => ({ followWorkspaceRepository: { states: vi.fn() } }));
vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) =>
      ReactModule.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: async () => sources.locale,
}));
vi.mock("../apps/web/src/lib/services/discovery-service", () => ({
  discoveryService: {
    page: async (input: { query: string; page: number }) => ({
      type: "servers",
      items: input.query ? await sources.search(input.query, 24) : await sources.servers(24),
      page: input.page,
      hasMore: false,
    }),
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => null },
}));
vi.mock("../apps/web/src/components/follow-button", () => ({ FollowButton: () => null }));
vi.mock("../apps/web/src/lib/services/content-service", () => ({ contentService: {} }));
vi.mock("../apps/web/src/lib/services/product-service", () => ({ productService: {} }));
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../apps/web/src/lib/services/mta-master-directory-service")
  >()),
  mtaMasterDirectoryService: { getDirectory: sources.directory },
}));

import { discoveryCopy } from "../apps/web/src/lib/discovery-copy";
import DiscoverPage from "../apps/web/src/app/discover/page";

async function loadResults(query = "") {
  const shell = await DiscoverPage({
    searchParams: Promise.resolve({ type: "servers", q: query }),
  });
  return shell;
}
async function renderResults(query = "") {
  return renderToStaticMarkup(await loadResults(query));
}
const editorial = (id: string, ipAddress: string, port = 22003) => ({
  id,
  name: id,
  slug: id,
  ipAddress,
  port,
  maxPlayers: 80,
});

beforeEach(() => {
  for (const source of [sources.servers, sources.search, sources.directory]) source.mockReset();
  sources.locale = "en";
  sources.servers.mockResolvedValue([]);
  sources.search.mockResolvedValue([]);
  sources.directory.mockResolvedValue({ servers: [], isStale: false });
});

describe("discover server observation lookup", () => {
  it("visits only twelve entries for twelve early matches", async () => {
    let addressReads = 0;
    sources.directory.mockResolvedValue({
      isStale: false,
      servers: Array.from({ length: 10_000 }, (_, index) => ({
        get address() {
          addressReads++;
          return `server-${index}.test`;
        },
        port: 22003,
        players: index,
      })),
    });
    sources.servers.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => editorial(`early-${index}`, `server-${index}.test`)),
    );
    const html = await renderResults();
    expect((html.match(/href="\/servers\/early-/g) ?? []).length).toBe(12);
    expect(html).toContain("11 / 80");
    expect(addressReads).toBe(12);
  });

  it.each(["", "missing"])(
    "scans one 10,000-entry snapshot for twelve unmatched cards (query %s)",
    async (query) => {
      let addressReads = 0;
      const servers = Array.from({ length: 10_000 }, (_, index) => ({
        get address() {
          addressReads++;
          return `server-${index}.test`;
        },
        port: 22003,
        players: 99,
      }));
      const listings = Array.from({ length: 12 }, (_, index) =>
        editorial(`listing-${index}`, `missing-${index}.test`),
      );
      sources.servers.mockResolvedValue(listings);
      sources.search.mockResolvedValue(listings);
      sources.directory.mockResolvedValue({ servers, isStale: false });
      const html = await renderResults(query);
      expect((html.match(/href="\/servers\/listing-/g) ?? []).length).toBe(12);
      expect(addressReads).toBe(10_000);
      expect(sources.directory).toHaveBeenCalledOnce();
      expect(query ? sources.search : sources.servers).toHaveBeenCalledWith(
        ...(query ? [query, 24] : [24]),
      );
    },
  );

  it("preserves a single early match without visiting later entries", async () => {
    const later = vi.fn(() => "unused.test");
    sources.servers.mockResolvedValue([editorial("single", " PLAY.TEST. ")]);
    sources.directory.mockResolvedValue({
      isStale: false,
      servers: [
        { address: "play.test", port: 22003, players: 0, maxPlayers: 32 },
        {
          get address() {
            return later();
          },
          port: 22003,
          players: 99,
        },
      ],
    });
    expect(await renderResults()).toContain("0 / 32");
    expect(later).not.toHaveBeenCalled();
  });

  it.each(["en", "ru"] as const)(
    "preserves normalized endpoints, ports, first duplicates and unknown counts in %s",
    async (locale) => {
      sources.locale = locale;
      sources.servers.mockResolvedValue([
        editorial("zero", " PLAY.TEST. "),
        editorial("unknown", "play.test", 22004),
        editorial("ipv6", "2001:DB8::1"),
      ]);
      sources.directory.mockResolvedValue({
        isStale: false,
        servers: [
          { address: "play.test", port: 22003, players: 0, maxPlayers: 32 },
          { address: "PLAY.TEST.", port: 22003, players: 99, maxPlayers: 100 },
          { address: "play.test", port: 22004 },
          { address: "play.test", port: 22004, players: 99 },
          { address: "2001:db8::1", port: 22003, players: 7, maxPlayers: 16 },
        ],
      });
      const html = await renderResults();
      expect(html).toContain("0 / 32");
      expect(html).toContain("7 / 16");
      expect(html).toContain(getDictionary(locale).servers.unknown);
      expect(html).not.toContain("99 /");
    },
  );

  it("retains stale observations while hiding stale player counts", async () => {
    sources.servers.mockResolvedValue([
      editorial("stale-a", "a.test"),
      editorial("stale-b", "b.test"),
    ]);
    sources.directory.mockResolvedValue({
      isStale: true,
      servers: [
        { address: "a.test", port: 22003, players: 99, maxPlayers: 32 },
        { address: "b.test", port: 22003, players: 77, maxPlayers: 16 },
      ],
    });
    const tree = await loadResults();
    const html = renderToStaticMarkup(tree);
    expect(html).not.toContain("99 /");
    expect(html).not.toContain("77 /");
    expect(html).toContain(getDictionary("en").servers.unknown);
  });

  it("renders an empty state without scanning the directory", async () => {
    const inspected = vi.fn(() => "unused.test");
    sources.directory.mockResolvedValue({
      isStale: false,
      servers: [
        {
          get address() {
            return inspected();
          },
          port: 22003,
        },
      ],
    });
    expect(await renderResults()).toContain(discoveryCopy("en").empty);
    expect(inspected).not.toHaveBeenCalled();
  });

  it("renders unknown live data when the upstream fails", async () => {
    sources.servers.mockResolvedValue([editorial("fallback", "a.test")]);
    sources.directory.mockRejectedValue(new Error("Upstream unavailable"));
    const html = await renderResults();
    expect(html).toContain('href="/servers/fallback"');
    expect(html).toContain(getDictionary("en").servers.unknown);
  });
});
