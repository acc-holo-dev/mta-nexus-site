import {
  productRepository,
  serverRepository,
  contentRepository,
  userRepository,
  organizationRepository,
} from "@nexus/db";
import {
  matchesMtaEndpoint,
  mtaMasterDirectoryService,
} from "./mta-master-directory-service";

interface SearchResultItem {
  id: string;
  type: "product" | "server" | "developer" | "organization" | "article";
  title: string;
  description: string;
  url: string;
  players?: number;
  maxPlayers?: number;
  verified?: boolean;
}

export type SearchResultType = SearchResultItem["type"];

class DiscoveryService {
  async search(
    query: string,
    limit = 50,
    type?: SearchResultType
  ): Promise<SearchResultItem[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) {
      return [];
    }

    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 50)
      : 50;
    // Each category is filtered before its own LIMIT. A full product category
    // must not hide server matches from a player using the global search.
    const [products, servers, articles, users, organizations] = await Promise.all([
      !type || type === "product"
        ? productRepository.list({ query: normalizedQuery, limit: boundedLimit })
        : [],
      !type || type === "server"
        ? serverRepository.searchActivePublic(normalizedQuery, boundedLimit)
        : [],
      !type || type === "article"
        ? contentRepository.searchPublished(normalizedQuery, boundedLimit)
        : [],
      !type || type === "developer"
        ? userRepository.searchDevelopers(normalizedQuery, boundedLimit)
        : [],
      !type || type === "organization"
        ? organizationRepository.searchPublic(normalizedQuery, boundedLimit)
        : [],
    ]);

    const groups: SearchResultItem[][] = [
      products.map((p) => ({
        id: p.id,
        type: "product",
        title: p.title,
        description: p.shortDescription || p.description.slice(0, 100),
        url: `/market/${p.slug}`,
      })),
      servers.map((s) => ({
        id: s.id,
        type: "server",
        title: s.name,
        description: s.description?.slice(0, 100) || `${s.gameMode || "MTA"} Server`,
        url: `/servers/${s.slug}`,
      })),
      articles.map((a) => ({
        id: a.id,
        type: "article",
        title: a.title,
        description: a.excerpt || a.body.slice(0, 100),
        url: `/articles/${a.slug}`,
      })),
      users.map((u) => ({
        id: u.id,
        type: "developer",
        title: u.displayName,
        description: u.bio || `@${u.username}`,
        url: `/developers/${u.username}`,
      })),
      organizations.map((o) => ({
        id: o.id,
        type: "organization",
        title: o.name,
        description: o.description?.slice(0, 100) || `@${o.slug}`,
        url: `/organizations/${o.slug}`,
        verified: o.isVerified,
      })),
    ];

    const results: SearchResultItem[] = [];
    for (let index = 0; results.length < boundedLimit; index++) {
      let added = false;
      for (const group of groups) {
        const item = group[index];
        if (!item) continue;
        results.push(item);
        added = true;
        if (results.length === boundedLimit) break;
      }
      if (!added) break;
    }

    // Resolve only server results actually shown. An outdated observation must
    // never be displayed as a current player count in global search.
    if (results.some((item) => item.type === "server")) {
      try {
        const directory = await mtaMasterDirectoryService.getDirectory();
        if (!directory.isStale) {
          const byId = new Map(servers.map((server) => [server.id, server]));
          for (const item of results) {
            if (item.type !== "server") continue;
            const server = byId.get(item.id);
            const observation = server && directory.servers.find((candidate) =>
              matchesMtaEndpoint(server, candidate),
            );
            if (observation?.players != null) {
              item.players = observation.players;
              item.maxPlayers = observation.maxPlayers;
            }
          }
        }
      } catch {
        // Search remains available when the official directory is unavailable.
      }
    }

    return results;
  }
}

export const discoveryService = new DiscoveryService();
