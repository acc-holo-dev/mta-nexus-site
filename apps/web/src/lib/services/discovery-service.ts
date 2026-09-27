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

export interface SearchResultItem {
  id: string;
  type: "product" | "server" | "developer" | "organization" | "article";
  title: string;
  description: string;
  url: string;
  badge?: string;
}

export type SearchResultType = SearchResultItem["type"];

export class DiscoveryService {
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
    const results: SearchResultItem[] = [];

    // Filter before LIMIT in the database: otherwise results beyond the first
    // page of recently updated rows cannot be found at all.
    const products = !type || type === "product"
      ? await productRepository.list({ query: normalizedQuery, limit: boundedLimit })
      : [];
    for (const p of products) {
      results.push({
        id: p.id,
        type: "product",
        title: p.title,
        description: p.shortDescription || p.description.slice(0, 100),
        url: `/market/${p.slug}`,
        badge: `$${(p.price / 100).toFixed(2)}`,
      });
    }

    const servers = (!type || type === "server") && results.length < boundedLimit
      ? await serverRepository.searchActivePublic(normalizedQuery, boundedLimit - results.length)
      : [];
    // Player counts are shown only when the official directory has an observation.
    let observations: Awaited<ReturnType<typeof mtaMasterDirectoryService.getDirectory>>["servers"] = [];
    if (servers.length > 0) {
      try {
        observations = (await mtaMasterDirectoryService.getDirectory()).servers;
      } catch {
        // Search remains available when the official directory is unavailable.
      }
    }
    for (const s of servers) {
      const observation = observations.find((item) => matchesMtaEndpoint(s, item));
      results.push({
        id: s.id,
        type: "server",
        title: s.name,
        description: s.description?.slice(0, 100) || `${s.gameMode || "MTA"} Server`,
        url: `/servers/${s.slug}`,
        badge: observation
          ? `${observation.players ?? 0}/${observation.maxPlayers ?? s.maxPlayers} players`
          : "MTA server",
      });
    }

    const articles = (!type || type === "article") && results.length < boundedLimit
      ? await contentRepository.searchPublished(normalizedQuery, boundedLimit - results.length)
      : [];
    for (const a of articles) {
      results.push({
        id: a.id,
        type: "article",
        title: a.title,
        description: a.excerpt || a.body.slice(0, 100),
        url: `/articles/${a.slug}`,
        badge: a.type,
      });
    }

    const users = (!type || type === "developer") && results.length < boundedLimit
      ? await userRepository.searchDevelopers(normalizedQuery, boundedLimit - results.length)
      : [];
    for (const u of users) {
      results.push({
        id: u.id,
        type: "developer",
        title: u.displayName,
        description: u.bio || `@${u.username}`,
        url: `/developers/${u.username}`,
        badge: "Developer",
      });
    }

    const organizations = (!type || type === "organization") && results.length < boundedLimit
      ? await organizationRepository.searchPublic(normalizedQuery, boundedLimit - results.length)
      : [];
    for (const o of organizations) {
      results.push({
        id: o.id,
        type: "organization",
        title: o.name,
        description: o.description?.slice(0, 100) || `@${o.slug}`,
        url: `/organizations/${o.slug}`,
        badge: o.isVerified ? "Verified Studio" : "Studio",
      });
    }

    return results.slice(0, boundedLimit);
  }
}

export const discoveryService = new DiscoveryService();
