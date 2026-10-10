import { publicationFeedRepository } from "@nexus/db";
import { NotFoundError } from "@nexus/domain";
import { safeExternalWebUrl } from "@nexus/validation";
import type { PublicationScope } from "@nexus/db";
import { encodeDiscussionCursor } from "../content-discussion-contract";
import type { PublicationQuery, PublicationPage } from "../publication-feed-contract";
class PublicationFeedService {
  async resolve(kind: "user" | "organization", handle: string) {
    if (!handle || handle.length > 128 || /[\s/]/u.test(handle) || [...handle].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
      throw new NotFoundError("Profile");
    const profile = await publicationFeedRepository.resolvePublicScope(kind, handle);
    if (!profile) throw new NotFoundError("Profile");
    return profile;
  }
  async page(scope: PublicationScope, query: PublicationQuery): Promise<PublicationPage> {
    const page = await publicationFeedRepository.page(scope, query);
    const context = (name: string | null, handle: string | null, path: string) =>
      name && handle ? { name, href: `/${path}/${encodeURIComponent(handle)}` } : null;
    return {
      items: page.items.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        type: row.type as PublicationPage["items"][number]["type"],
        excerpt: row.excerpt,
        image: safeExternalWebUrl(row.coverImageUrl) ?? null,
        publishedAt: row.publishedAt.toISOString(),
        commentCount: Math.max(0, row.commentCount),
        author: {
          username: row.username,
          name: row.displayName,
          avatar: safeExternalWebUrl(row.avatarUrl) ?? null,
        },
        organization: context(row.organizationName, row.organizationSlug, "organizations"),
        server: context(row.serverName, row.serverSlug, "servers"),
        product: context(row.productName, row.productSlug, "market"),
      })),
      hasMore: page.hasMore,
      nextCursor: page.nextCursor ? encodeDiscussionCursor(page.nextCursor) : null,
    };
  }
}
export const publicationFeedService = new PublicationFeedService();
