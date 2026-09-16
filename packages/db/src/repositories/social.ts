import { eq, and } from "drizzle-orm";
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

  async follow(followData: Omit<Follow, "createdAt">): Promise<Follow> {
    const values = {
      ...followData,
      createdAt: new Date(),
    };

        const rows = await db.insert(follows).values(values).returning();
    return rows[0] as unknown as Follow;
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

  async listFollows(followerId: string, targetType?: string): Promise<Follow[]> {
        if (targetType) {
      const rows = await db
        .select()
        .from(follows)
        .where(
          and(
            eq(follows.followerId, followerId),
            eq(follows.targetType, targetType)
          )
        );
      return rows as unknown as Follow[];
    }
    const rows = await db
      .select()
      .from(follows)
      .where(eq(follows.followerId, followerId));
    return rows as unknown as Follow[];
  }
}

export const socialRepository = new SocialRepository();
