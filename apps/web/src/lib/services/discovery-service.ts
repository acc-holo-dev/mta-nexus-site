import {
  productRepository,
  serverRepository,
  contentRepository,
  userRepository,
  organizationRepository,
  publicDirectoryRepository,
  authorContentRepository,
} from "@nexus/db";
import { safeExternalWebUrl } from "@nexus/validation";
import { createHash } from "node:crypto";
import { AppError } from "@nexus/domain";
import type { DiscoveryStreamQuery } from "../discovery-stream-contract";
import type { DiscoverQuery } from "../discover-query";
import { DISCOVER_CONTENT_TYPES } from "../discover-query";
import { productService } from "./product-service";
import {
  indexMtaObservations,
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
  async page(input: DiscoverQuery) {
    if (input.type === "resources") {
      const result = await productService.listPublicPage({ query: input.query || undefined,
        sort: input.query ? "relevance" : "newest", page: input.page, pageSize: 24 });
      return { type: "resources" as const, items: result.products, page: input.page, hasMore: result.hasMore && input.page < 1000 };
    }
    if (input.type === "content") {
      const result = await authorContentRepository.pagePublic([...DISCOVER_CONTENT_TYPES], {
        query: input.query, page: input.page, type: input.contentType || undefined,
      });
      return { ...result, hasMore: result.hasMore && input.page < 1000, type: "content" as const };
    }
    return this.directory(input);
  }
  async stream(input: DiscoveryStreamQuery) {
    const context = createHash("sha256")
      .update(
        JSON.stringify([
          1,
          "discovery-stream",
          input.type,
          input.query,
          input.verified,
          input.language,
          input.region,
          input.gameMode,
        ]),
      )
      .digest("hex");
    if (input.cursor && input.cursor.context !== context)
      throw new AppError("Directory filters changed", 400, "INVALID_CURSOR");
    const result = await this.directory({ ...input, keyset: true });
    return {
      ...result,
      nextCursor: result.nextCursor
        ? JSON.stringify({ ...result.nextCursor, context, version: 1, direction: "older" })
        : null,
      previousCursor: result.previousCursor
        ? JSON.stringify({ ...result.previousCursor, context, version: 1, direction: "newer" })
        : null,
    };
  }
  private async directory(
    input: DiscoverQuery & { keyset?: boolean; cursor?: DiscoveryStreamQuery["cursor"] },
  ) {
    if (input.type === "creators") {
      const result = await publicDirectoryRepository.pageCreators(input);
      return {
        ...result,
        type: "creators" as const,
        items: result.items.map((item) => ({
          ...item,
          avatarUrl: safeExternalWebUrl(item.avatarUrl) ?? null,
        })),
      };
    }
    if (input.type === "organizations") {
      const result = await publicDirectoryRepository.pageOrganizations(input);
      return {
        ...result,
        type: "organizations" as const,
        items: result.items.map((item) => ({
          ...item,
          logoUrl: safeExternalWebUrl(item.logoUrl) ?? null,
        })),
      };
    }
    const result = await publicDirectoryRepository.pageServers(input);
    return {
      ...result,
      type: "servers" as const,
      items: result.items.map((item) => ({
        ...item,
        bannerUrl: safeExternalWebUrl(item.bannerUrl) ?? undefined,
        description: item.description ?? undefined,
        gameMode: item.gameMode ?? undefined,
        maxPlayers: item.maxPlayers ?? undefined,
        logoUrl: safeExternalWebUrl(item.logoUrl) ?? undefined,
      })),
    };
  }
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
    const serverResults = results.filter((item) => item.type === "server");
    if (serverResults.length) {
      try {
        const directory = await mtaMasterDirectoryService.getDirectory();
        if (!directory.isStale) {
          const byId = new Map(servers.map((server) => [server.id, server]));
          const observationFor = serverResults.length === 1
            ? (server: { ipAddress: string; port: number }) => directory.servers.find(candidate =>
                matchesMtaEndpoint(server, candidate),
              )
            : indexMtaObservations(directory.servers);
          for (const item of serverResults) {
            const server = byId.get(item.id);
            const observation = server && observationFor(server);
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
