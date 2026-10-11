import { and, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../client";
import { builds, content, follows, organizations, products, servers, userProfilePreferences, users } from "../schema";
import { containsPattern } from "./search-pattern";
import { trustedCleanScanCondition } from "./build-safety";

export type PublicationScope =
  | { kind: "following"; actorId: string }
  | { kind: "user"; id: string }
  | { kind: "organization"; id: string };
type PublicationFilters = {
  query?: string;
  type?: string;
  source?: "user" | "organization" | "server" | "product";
  cursor?: { createdAt: string; id: string };
};
const publicTypes = [
  "article",
  "devlog",
  "announcement",
  "review",
  "post",
  "question",
  "news",
  "update",
];
const publishedTime = sql`coalesce(${content.publishedAt}, ${content.createdAt})`;
const publicServer = and(eq(servers.visibility, "public"), eq(servers.status, "active"));
const activityVisible = sql<boolean>`coalesce(${userProfilePreferences.showActivity}, true)`;
function publicProduct() {
  return and(
    eq(products.status, "published"),
    eq(products.price, 0),
    exists(
      db
        .select({ id: builds.id })
        .from(builds)
        .where(
          and(
            eq(builds.productId, products.id),
            eq(builds.status, "published"),
            trustedCleanScanCondition(),
          ),
        ),
    ),
  );
}
class PublicationFeedRepository {
  async resolvePublicScope(kind: "user" | "organization", handle: string) {
    if (kind === "user") {
      const [row] = await db
        .select({ id: users.id, name: users.displayName })
        .from(users)
        .leftJoin(userProfilePreferences, eq(userProfilePreferences.userId, users.id))
        .where(and(eq(users.username, handle), activityVisible))
        .limit(1);
      return row ?? null;
    }
    const [row] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.slug, handle))
      .limit(1);
    return row ?? null;
  }

  async page(scope: PublicationScope, filters: PublicationFilters = {}) {
    const ids = (type: string) =>
      db
        .select({ id: follows.targetId })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, scope.kind === "following" ? scope.actorId : ""),
            eq(follows.targetType, type),
          ),
        );
    const sources = {
      user: and(inArray(content.authorId, ids("user")), activityVisible),
      organization: inArray(content.organizationId, ids("organization")),
      server: inArray(servers.id, ids("server")),
      product: inArray(products.id, ids("product")),
    };
    // Membership predicates yield one publication even when several subscriptions match.
    // The existing (follower, type, target) index serves each scoped ID subquery.
    const scopeCondition =
      scope.kind === "following"
        ? filters.source
          ? sources[filters.source]
          : or(...Object.values(sources))
        : scope.kind === "user"
          ? and(eq(content.authorId, scope.id), activityVisible)
          : eq(content.organizationId, scope.id);
    const pattern = filters.query?.trim()
      ? containsPattern(filters.query.trim().slice(0, 100))
      : undefined;
    const rows = await db
      .select({
        id: content.id,
        slug: content.slug,
        title: content.title,
        type: content.type,
        excerpt: sql<string>`left(coalesce(nullif(${content.excerpt}, ''), ${content.body}), 350)`,
        coverImageUrl: content.coverImageUrl,
        commentCount: content.commentCount,
        publishedAt: sql<Date>`${publishedTime}`.mapWith(content.createdAt),
        cursorTime: sql<string>`to_char(${publishedTime} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        authorId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
        serverName: servers.name,
        serverSlug: servers.slug,
        productName: products.title,
        productSlug: products.slug,
      })
      .from(content)
      .innerJoin(users, eq(users.id, content.authorId))
      .leftJoin(userProfilePreferences, eq(userProfilePreferences.userId, users.id))
      .leftJoin(organizations, eq(organizations.id, content.organizationId))
      .leftJoin(servers, and(eq(servers.id, content.serverId), publicServer))
      .leftJoin(products, and(eq(products.id, content.productId), publicProduct()))
      .where(
        and(
          eq(content.status, "published"),
          inArray(content.type, publicTypes),
          scopeCondition,
          filters.type ? eq(content.type, filters.type) : undefined,
          pattern
            ? or(
                ilike(content.title, pattern),
                ilike(content.excerpt, pattern),
                ilike(content.body, pattern),
                sql`exists (select 1 from jsonb_array_elements_text(${content.tags}) as tag(value) where tag.value ilike ${pattern})`,
              )
            : undefined,
          filters.cursor
            ? sql`(${publishedTime}, ${content.id}) < (${filters.cursor.createdAt}::timestamptz, ${filters.cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(publishedTime), desc(content.id))
      .limit(21);
    const items = rows.slice(0, 20),
      last = items.at(-1);
    return {
      items,
      hasMore: rows.length > 20,
      nextCursor: rows.length > 20 && last ? { createdAt: last.cursorTime, id: last.id } : null,
    };
  }
}
export const publicationFeedRepository = new PublicationFeedRepository();
