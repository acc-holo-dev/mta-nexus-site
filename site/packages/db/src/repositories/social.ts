import { AppError, type Follow, NotFoundError } from "@nexus/domain";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../client";
import { content, follows, organizations, products, servers, users } from "../schema";

export class SocialRepository {
  async isFollowing(followerId: string, targetType: string, targetId: string): Promise<boolean> {
    const rows = await db
      .select({ id: follows.id })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.targetType, targetType),
          eq(follows.targetId, targetId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async follow(
    followData: Omit<Follow, "createdAt" | "notifyComments"> & { notifyComments?: boolean },
  ): Promise<Follow | null> {
    if (followData.followerId === followData.targetId) {
      throw new AppError("Cannot follow yourself", 400, "SELF_FOLLOW");
    }
    const values = {
      ...followData,
      notifyComments: followData.notifyComments ?? true,
      createdAt: new Date(),
    };

    return db.transaction(async (tx) => {
      const targetId = followData.targetId;
      const target =
        followData.targetType === "user"
          ? await tx
              .select({ id: users.id })
              .from(users)
              .where(eq(users.id, targetId))
              .limit(1)
              .for("share")
          : followData.targetType === "server"
            ? await tx
                .select({ id: servers.id })
                .from(servers)
                .where(eq(servers.id, targetId))
                .limit(1)
                .for("share")
            : followData.targetType === "organization"
              ? await tx
                  .select({ id: organizations.id })
                  .from(organizations)
                  .where(eq(organizations.id, targetId))
                  .limit(1)
                  .for("share")
              : followData.targetType === "product"
                ? await tx
                    .select({ id: products.id })
                    .from(products)
                    .where(eq(products.id, targetId))
                    .limit(1)
                    .for("share")
                : followData.targetType === "content"
                  ? await tx
                      .select({ id: content.id })
                      .from(content)
                      .where(eq(content.id, targetId))
                      .limit(1)
                      .for("share")
                  : [];
      if (target.length === 0) throw new NotFoundError("Follow target", targetId);
      const rows = await tx.insert(follows).values(values).onConflictDoNothing().returning();
      return (rows[0] as unknown as Follow) || null;
    });
  }

  async unfollow(followerId: string, targetType: string, targetId: string): Promise<void> {
    await db
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.targetType, targetType),
          eq(follows.targetId, targetId),
        ),
      );
  }

  async listFollowersByTarget(
    targetType: Follow["targetType"],
    targetId: string,
    limit = 100,
  ): Promise<Follow[]> {
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 500)
      : 100;
    const rows = await db
      .select()
      .from(follows)
      .where(and(eq(follows.targetType, targetType), eq(follows.targetId, targetId)))
      .orderBy(desc(follows.createdAt))
      .limit(boundedLimit);
    return rows as unknown as Follow[];
  }

  async listFollows(followerId: string, targetType?: string): Promise<Follow[]> {
    if (targetType) {
      const rows = await db
        .select()
        .from(follows)
        .where(and(eq(follows.followerId, followerId), eq(follows.targetType, targetType)))
        .orderBy(desc(follows.createdAt));
      return rows as unknown as Follow[];
    }
    const rows = await db
      .select()
      .from(follows)
      .where(eq(follows.followerId, followerId))
      .orderBy(desc(follows.createdAt));
    return rows as unknown as Follow[];
  }
}

export const socialRepository = new SocialRepository();
