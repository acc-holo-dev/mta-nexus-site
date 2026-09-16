import { eq, desc, and } from "drizzle-orm";
import { db } from "../client";
import { notifications } from "../schema";
import type { Notification } from "@nexus/domain";

export class NotificationRepository {
  async listByUser(recipientId: string, limit = 50): Promise<Notification[]> {
    try {
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.recipientId, recipientId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit);
      return rows as unknown as Notification[];
    } catch {
      return [];
    }
  }

  async countUnread(recipientId: string): Promise<number> {
    try {
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
    } catch {
      return 0;
    }
  }

  async create(data: Omit<Notification, "createdAt" | "isRead">): Promise<Notification> {
    const values = {
      ...data,
      isRead: false,
      createdAt: new Date(),
    };

    try {
      const rows = await db.insert(notifications).values(values).returning();
      return rows[0] as unknown as Notification;
    } catch {
      return values as unknown as Notification;
    }
  }

  async markAsRead(id: string): Promise<void> {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, id));
    } catch {
      // ignore
    }
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.recipientId, recipientId));
    } catch {
      // ignore
    }
  }
}

export const notificationRepository = new NotificationRepository();
