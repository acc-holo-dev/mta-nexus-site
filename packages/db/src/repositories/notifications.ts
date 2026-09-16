import { eq, desc, and } from "drizzle-orm";
import { db } from "../client";
import { notifications } from "../schema";
import type { Notification } from "@nexus/domain";

export class NotificationRepository {
  async listByUser(recipientId: string, limit = 50): Promise<Notification[]> {
        const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, recipientId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    return rows as unknown as Notification[];
  }

  async countUnread(recipientId: string): Promise<number> {
        const rows = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.isRead, false)
        )
      );
    return rows.length;
  }

  async create(data: Omit<Notification, "createdAt" | "isRead">): Promise<Notification> {
    const values = {
      ...data,
      isRead: false,
      createdAt: new Date(),
    };

        const rows = await db.insert(notifications).values(values).returning();
    return rows[0] as unknown as Notification;
  }

  async markAsRead(id: string, recipientId: string): Promise<boolean> {
        // Ownership enforcement: only the recipient can mark their own notification
    const rows = await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.recipientId, recipientId)
        )
      )
      .returning();
    return rows.length > 0;
  }

  async markAllAsRead(recipientId: string): Promise<void> {
        await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.recipientId, recipientId));
  }
}

export const notificationRepository = new NotificationRepository();
