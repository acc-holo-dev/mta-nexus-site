import {
  productRepository,
  serverRepository,
  contentRepository,
  userRepository,
  organizationRepository,
} from "@nexus/db";

export interface SearchResultItem {
  id: string;
  type: "product" | "server" | "developer" | "organization" | "article";
  title: string;
  description: string;
  url: string;
  badge?: string;
}

export class DiscoveryService {
  async search(query: string, limit = 50): Promise<SearchResultItem[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) {
      return [];
    }

    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 50)
      : 50;
    const q = normalizedQuery.toLowerCase();
    const results: SearchResultItem[] = [];

    // Keep each source bounded so one public query cannot materialize every row.
    const products = await productRepository.list({ query: normalizedQuery, limit: boundedLimit });
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

    // Search Servers
    const servers = await serverRepository.listActivePublic(boundedLimit);
    for (const s of servers) {
      if (
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.gameMode?.toLowerCase().includes(q)
      ) {
        results.push({
          id: s.id,
          type: "server",
          title: s.name,
          description: s.description?.slice(0, 100) || `${s.gameMode || "MTA"} Server`,
          url: `/servers/${s.slug}`,
          badge: `${s.currentPlayers}/${s.maxPlayers} players`,
        });
      }
    }

    // Search Articles
    const articles = await contentRepository.listPublished(boundedLimit);
    for (const a of articles) {
      if (
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      ) {
        results.push({
          id: a.id,
          type: "article",
          title: a.title,
          description: a.excerpt || a.body.slice(0, 100),
          url: `/articles/${a.slug}`,
          badge: a.type,
        });
      }
    }

    // Search Developers
    const users = await userRepository.listAll(boundedLimit);
    for (const u of users) {
      if (
        u.role === "developer" &&
        (u.username.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q) ||
          u.bio?.toLowerCase().includes(q))
      ) {
        results.push({
          id: u.id,
          type: "developer",
          title: u.displayName,
          description: u.bio || `@${u.username}`,
          url: `/developers/${u.username}`,
          badge: "Developer",
        });
      }
    }

    // Search Organizations
    const organizations = await organizationRepository.listAll(boundedLimit);
    for (const o of organizations) {
      if (
        o.name.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q)
      ) {
        results.push({
          id: o.id,
          type: "organization",
          title: o.name,
          description: o.description?.slice(0, 100) || `@${o.slug}`,
          url: `/organizations/${o.slug}`,
          badge: o.isVerified ? "Verified Studio" : "Studio",
        });
      }
    }

    return results.slice(0, boundedLimit);
  }
}

export const discoveryService = new DiscoveryService();
