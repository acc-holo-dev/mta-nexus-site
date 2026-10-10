import { and, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { AppError, NotFoundError } from "@nexus/domain";
import { db } from "../client";
import { builds, follows, organizations, products, servers, users } from "../schema";
import { containsPattern } from "./search-pattern";
import { trustedCleanScanCondition } from "./build-safety";
type TargetType = "user" | "organization" | "server" | "product";
type Cursor = { createdAt: string; id: string };
function availableResourceBuild() {
  return exists(
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
  );
}
class FollowWorkspaceRepository {
  async states(actorId: string, targetType: TargetType, targetIds: readonly string[]) {
    const ids = [...new Set(targetIds)].slice(0, 50);
    if (!ids.length) return [];
    const rows = await db
      .select({ targetId: follows.targetId })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, actorId),
          eq(follows.targetType, targetType),
          inArray(follows.targetId, ids),
        ),
      )
      .limit(50);
    return rows.map((row) => row.targetId);
  }
  async page(
    actorId: string,
    filters: { type?: TargetType; query?: string; cursor?: Cursor } = {},
  ) {
    const pattern = filters.query?.trim()
      ? containsPattern(filters.query.trim().slice(0, 100))
      : undefined;
    // Access conditions live in JOINs: inaccessible targets retain a removable
    // follow key but expose no title, image, URL, status or other target metadata.
    const rows = await db
      .select({
        id: follows.id,
        targetType: follows.targetType,
        targetId: follows.targetId,
        createdAt: follows.createdAt,
        cursorTime: sql<string>`to_char(${follows.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        title: sql<
          string | null
        >`coalesce(${users.displayName}, ${organizations.name}, ${servers.name}, ${products.title})`,
        handle: sql<
          string | null
        >`coalesce(${users.username}, ${organizations.slug}, ${servers.slug}, ${products.slug})`,
        description: sql<
          string | null
        >`left(coalesce(${users.bio}, ${organizations.description}, ${servers.description}, ${products.shortDescription}), 350)`,
        image: sql<
          string | null
        >`coalesce(${users.avatarUrl}, ${organizations.logoUrl}, ${servers.logoUrl})`,
        verified: sql<boolean>`coalesce(${users.isVerified}, ${organizations.isVerified}, ${servers.isVerified}, false)`,
      })
      .from(follows)
      .leftJoin(users, and(eq(follows.targetType, "user"), eq(users.id, follows.targetId)))
      .leftJoin(
        organizations,
        and(eq(follows.targetType, "organization"), eq(organizations.id, follows.targetId)),
      )
      .leftJoin(
        servers,
        and(
          eq(follows.targetType, "server"),
          eq(servers.id, follows.targetId),
          inArray(servers.visibility, ["public", "unlisted"]),
          inArray(servers.status, ["active", "inactive", "maintenance"]),
        ),
      )
      .leftJoin(
        products,
        and(
          eq(follows.targetType, "product"),
          eq(products.id, follows.targetId),
          eq(products.status, "published"),
          eq(products.price, 0),
          availableResourceBuild(),
        ),
      )
      .where(
        and(
          eq(follows.followerId, actorId),
          inArray(follows.targetType, ["user", "organization", "server", "product"]),
          filters.type ? eq(follows.targetType, filters.type) : undefined,
          pattern
            ? or(
                ilike(users.displayName, pattern),
                ilike(users.username, pattern),
                ilike(organizations.name, pattern),
                ilike(organizations.slug, pattern),
                ilike(servers.name, pattern),
                ilike(products.title, pattern),
              )
            : undefined,
          filters.cursor
            ? sql`(${follows.createdAt}, ${follows.id}) < (${filters.cursor.createdAt}::timestamptz, ${filters.cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(follows.createdAt), desc(follows.id))
      .limit(21);
    const items = rows.slice(0, 20);
    const last = items.at(-1);
    return {
      items,
      hasMore: rows.length > 20,
      nextCursor: rows.length > 20 && last ? { createdAt: last.cursorTime, id: last.id } : null,
    };
  }

  async setFollowing(
    actorId: string,
    targetType: TargetType,
    targetId: string,
    following: boolean,
    id: string,
  ) {
    if (following && targetType === "user" && targetId === actorId)
      throw new AppError("Cannot follow yourself", 400, "SELF_FOLLOW");
    return db.transaction(async (tx) => {
      // Serialize desired-state commands for one actor/target, including
      // deletion when a polymorphic target has already disappeared.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([actorId, targetType, targetId])}, 0))`,
      );
      const key = and(
        eq(follows.followerId, actorId),
        eq(follows.targetType, targetType),
        eq(follows.targetId, targetId),
      );
      if (!following) {
        await tx.delete(follows).where(key);
        return { following: false, created: false };
      }
      // Share-lock the target through commit so a simultaneous archive,
      // suspension or privacy update cannot bypass the availability policy.
      let target: { id: string }[];
      switch (targetType) {
        case "user":
          target = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, targetId))
            .for("share")
            .limit(1);
          break;
        case "organization":
          target = await tx
            .select({ id: organizations.id })
            .from(organizations)
            .where(eq(organizations.id, targetId))
            .for("share")
            .limit(1);
          break;
        case "server":
          target = await tx
            .select({ id: servers.id })
            .from(servers)
            .where(
              and(
                eq(servers.id, targetId),
                inArray(servers.visibility, ["public", "unlisted"]),
                inArray(servers.status, ["active", "inactive", "maintenance"]),
              ),
            )
            .for("share")
            .limit(1);
          break;
        case "product":
          target = await tx
            .select({ id: products.id })
            .from(products)
            .where(
              and(
                eq(products.id, targetId),
                eq(products.status, "published"),
                eq(products.price, 0),
                availableResourceBuild(),
              ),
            )
            .for("share")
            .limit(1);
          break;
      }
      if (!target.length) throw new NotFoundError("Follow target");
      const [created] = await tx
        .insert(follows)
        .values({ id, followerId: actorId, targetType, targetId, createdAt: new Date() })
        .onConflictDoNothing()
        .returning({ id: follows.id });
      if (!created) {
        const [existing] = await tx.select({ id: follows.id }).from(follows).where(key).limit(1);
        if (!existing) throw new AppError("Follow could not be confirmed", 503, "UNCONFIRMED");
      }
      return { following: true, created: !!created };
    });
  }
}
export const followWorkspaceRepository = new FollowWorkspaceRepository();
