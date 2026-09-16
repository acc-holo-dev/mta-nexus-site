import {
  productRepository,
  serverRepository,
  contentRepository,
  userRepository,
} from "@nexus/db";

export interface SearchResultItem {
  id: string;
  type: "product" | "server" | "developer" | "article";
  title: string;
  description: string;
  url: string;
  badge?: string;
}

export class DiscoveryService {
  async search(query: string): Promise<SearchResultItem[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const q = query.toLowerCase();
    const results: SearchResultItem[] = [];

    // Search Products
    const products = await productRepository.list({ query });
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
    const servers = await serverRepository.listActivePublic();
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
    const articles = await contentRepository.listPublished();
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
    const users = await userRepository.listAll();
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

    return results;
  }
}

export const discoveryService = new DiscoveryService();
