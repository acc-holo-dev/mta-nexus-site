import { eq, and, desc } from "drizzle-orm";
import { db } from "../client";
import { follows } from "../schema";
import type { Follow } from "@nexus/domain";

export class SocialRepository {
  async isFollowing(
    followerId: string,
    targetType: string,
    targetId: string
  ): Promise<boolean> {
        const rows = await db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.targetType, targetType),
          eq(follows.targetId, targetId)
        )
      )
      .limit(1);
    return rows.length > 0;
  }

  async follow(followData: Omit<Follow, "createdAt">): Promise<Follow | null> {
    const values = {
      ...followData,
      createdAt: new Date(),
    };

    const rows = await db
      .insert(follows)
      .values(values)
      .onConflictDoNothing()
      .returning();
    return (rows[0] as unknown as Follow) || null;
  }

  async unfollow(followerId: string, targetType: string, targetId: string): Promise<void> {
        await db
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.targetType, targetType),
          eq(follows.targetId, targetId)
        )
      );
  }

  async listFollows(
    followerId: string,
    targetType?: string,
    limit = 100
  ): Promise<Follow[]> {
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 100)
      : 100;
    if (targetType) {
      const rows = await db
        .select()
        .from(follows)
        .where(
          and(
            eq(follows.followerId, followerId),
            eq(follows.targetType, targetType)
          )
        )
        .orderBy(desc(follows.createdAt))
        .limit(boundedLimit);
      return rows as unknown as Follow[];
    }
    const rows = await db
      .select()
      .from(follows)
      .where(eq(follows.followerId, followerId))
      .orderBy(desc(follows.createdAt))
      .limit(boundedLimit);
    return rows as unknown as Follow[];
  }
}

export const socialRepository = new SocialRepository();
