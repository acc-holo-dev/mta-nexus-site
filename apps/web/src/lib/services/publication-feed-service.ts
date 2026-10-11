import { createHash } from "node:crypto";
import type { PublicationScope } from "@nexus/db";
import { publicationFeedRepository } from "@nexus/db";
import { AppError, NotFoundError } from "@nexus/domain";
import { safeExternalWebUrl } from "@nexus/validation";
import {
  type PublicationPage,
  type PublicationQuery,
  SERVER_PUBLICATION_TYPES,
} from "../publication-feed-contract";

class PublicationFeedService {
  async resolve(kind: "user" | "organization" | "server", handle: string) {
    if (
      !handle ||
      handle.length > 128 ||
      /[\s/]/u.test(handle) ||
      [...handle].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    )
      throw new NotFoundError("Profile");
    const profile = await publicationFeedRepository.resolvePublicScope(kind, handle);
    if (!profile) throw new NotFoundError("Profile");
    return profile;
  }
  async page(scope: PublicationScope, query: PublicationQuery): Promise<PublicationPage> {
    if (
      query.target &&
      (scope.kind !== "following" ||
        !["user", "organization", "server"].includes(query.source ?? "") ||
        !/^[a-zA-Z0-9_-]{1,128}$/u.test(query.target))
    )
      throw new AppError("Invalid followed target", 400, "VALIDATION_ERROR");
    if (
      (scope.kind !== "following" && query.source) ||
      (scope.kind === "server" &&
        query.type &&
        !(SERVER_PUBLICATION_TYPES as readonly string[]).includes(query.type))
    )
      throw new AppError("Invalid publication filters", 400, "VALIDATION_ERROR");
    const contextHash = createHash("sha256")
      .update(
        JSON.stringify([
          1,
          scope.kind,
          scope.kind === "following" ? scope.actorId : scope.id,
          query.query,
          query.type ?? "",
          query.source ?? "",
          query.author?.toLowerCase() ?? "",
          query.tag?.toLowerCase() ?? "",
          ...(query.target ? [query.target] : []),
        ]),
      )
      .digest("hex");
    if (query.cursor && query.cursor.context !== contextHash)
      throw new AppError(
        "Publication page belongs to different filters or source",
        400,
        "INVALID_CURSOR",
      );
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
        tags: (row.tags ?? []).slice(0, 10).map((tag) => tag.slice(0, 30)),
      })),
      hasMore: page.hasMore,
      nextCursor: page.nextCursor
        ? JSON.stringify({
            ...page.nextCursor,
            version: 1,
            context: contextHash,
            direction: "older",
          })
        : null,
      previousCursor: page.previousCursor
        ? JSON.stringify({
            ...page.previousCursor,
            version: 1,
            context: contextHash,
            direction: "newer",
          })
        : null,
    };
  }
}
export const publicationFeedService = new PublicationFeedService();
