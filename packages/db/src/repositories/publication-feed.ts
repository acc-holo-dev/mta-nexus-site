import { and, asc, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../client";
import {
  builds,
  content,
  follows,
  organizations,
  products,
  servers,
  userProfilePreferences,
  users,
} from "../schema";
import { containsPattern } from "./search-pattern";
import { trustedCleanScanCondition } from "./build-safety";

export type PublicationScope =
  | { kind: "following"; actorId: string }
  | { kind: "user"; id: string }
  | { kind: "organization"; id: string }
  | { kind: "server"; id: string };
type PublicationFilters = {
  query?: string;
  type?: string;
  source?: "user" | "organization" | "server" | "product";
  author?: string;
  tag?: string;
  cursor?: { createdAt: string; id: string; direction?: "older" | "newer" };
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
const serverTypes = ["article", "news", "devlog", "update", "announcement"];
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
  async resolvePublicScope(kind: "user" | "organization" | "server", handle: string) {
    if (kind === "user") {
      const [row] = await db
        .select({ id: users.id, name: users.displayName })
        .from(users)
        .leftJoin(userProfilePreferences, eq(userProfilePreferences.userId, users.id))
        .where(and(eq(users.username, handle), activityVisible))
        .limit(1);
      return row ?? null;
    }
    if (kind === "server") {
      const [row] = await db
        .select({ id: servers.id, name: servers.name })
        .from(servers)
        .where(and(eq(servers.slug, handle), publicServer))
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
          : scope.kind === "server"
            ? eq(servers.id, scope.id)
            : eq(content.organizationId, scope.id);
    const pattern = filters.query?.trim()
      ? containsPattern(filters.query.trim().slice(0, 100))
      : undefined;
    const newer = filters.cursor?.direction === "newer";
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
        tags: sql<
          string[]
        >`(select coalesce(jsonb_agg(left(tag.value, 30)), '[]'::jsonb) from (select value from jsonb_array_elements_text(${content.tags}) limit 10) tag)`,
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
          inArray(content.type, scope.kind === "server" ? serverTypes : publicTypes),
          scopeCondition,
          filters.type ? eq(content.type, filters.type) : undefined,
          filters.author
            ? sql`lower(${users.username}) = ${filters.author.toLowerCase()}`
            : undefined,
          filters.tag
            ? sql`exists (select 1 from jsonb_array_elements_text(${content.tags}) as tag(value) where lower(tag.value) = ${filters.tag.toLowerCase()})`
            : undefined,
          pattern
            ? or(
                ilike(content.title, pattern),
                ilike(content.excerpt, pattern),
                ilike(content.body, pattern),
                ilike(users.username, pattern),
                ilike(users.displayName, pattern),
                sql`exists (select 1 from jsonb_array_elements_text(${content.tags}) as tag(value) where tag.value ilike ${pattern})`,
              )
            : undefined,
          filters.cursor
            ? newer
              ? sql`(${publishedTime}, ${content.id}) > (${filters.cursor.createdAt}::timestamptz, ${filters.cursor.id})`
              : sql`(${publishedTime}, ${content.id}) < (${filters.cursor.createdAt}::timestamptz, ${filters.cursor.id})`
            : undefined,
        ),
      )
      .orderBy(
        newer ? asc(publishedTime) : desc(publishedTime),
        newer ? asc(content.id) : desc(content.id),
      )
      .limit(21);
    const items = rows.slice(0, 20);
    if (newer) items.reverse();
    const first = items[0],
      last = items.at(-1);
    const hasMore = newer ? items.length > 0 : rows.length > 20;
    const hasPrevious = newer ? rows.length > 20 : !!filters.cursor && items.length > 0;
    return {
      items,
      hasMore,
      nextCursor: hasMore && last ? { createdAt: last.cursorTime, id: last.id } : null,
      previousCursor: hasPrevious && first ? { createdAt: first.cursorTime, id: first.id } : null,
    };
  }
}
export const publicationFeedRepository = new PublicationFeedRepository();
