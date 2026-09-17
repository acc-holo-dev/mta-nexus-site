import { eq, desc, and } from "drizzle-orm";
import { db } from "../client";
import { notificationPreferences, notifications } from "../schema";
import type { Notification, NotificationPreferences } from "@nexus/domain";

export class NotificationRepository {
  private defaultPreferences(userId: string): NotificationPreferences {
    return {
      id: `npr_${userId}`,
      userId,
      followsEnabled: true,
      contentEnabled: true,
      serverEnabled: true,
      commerceEnabled: true,
      systemEnabled: true,
      updatedAt: new Date(),
    };
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const rows = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    return (rows[0] as unknown as NotificationPreferences) || this.defaultPreferences(userId);
  }

  async updatePreferences(
    userId: string,
    updates: Partial<
      Pick<
        NotificationPreferences,
        "followsEnabled" | "contentEnabled" | "serverEnabled" | "commerceEnabled" | "systemEnabled"
      >
    >
  ): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    const values = {
      ...current,
      ...updates,
      id: current.id || `npr_${userId}`,
      userId,
      updatedAt: new Date(),
    };
    const rows = await db
      .insert(notificationPreferences)
      .values(values)
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          followsEnabled: values.followsEnabled,
          contentEnabled: values.contentEnabled,
          serverEnabled: values.serverEnabled,
          commerceEnabled: values.commerceEnabled,
          systemEnabled: values.systemEnabled,
          updatedAt: values.updatedAt,
        },
      })
      .returning();
    return rows[0] as unknown as NotificationPreferences;
  }

  async listByUser(
    recipientId: string,
    limit = 50,
    unreadOnly = false
  ): Promise<Notification[]> {
    const rows = await db
      .select()
      .from(notifications)
      .where(
        unreadOnly
          ? and(
              eq(notifications.recipientId, recipientId),
              eq(notifications.isRead, false)
            )
          : eq(notifications.recipientId, recipientId)
      )
      .orderBy(desc(notifications.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
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

  async create(
    data: Omit<Notification, "createdAt" | "isRead">
  ): Promise<Notification | null> {
    const preferences = await this.getPreferences(data.recipientId);
    const preferenceKey =
      data.type === "order" || data.type === "license"
        ? "commerceEnabled"
        : data.type === "content"
          ? "contentEnabled"
          : data.type === "server"
            ? "serverEnabled"
            : data.type === "system"
              ? "systemEnabled"
              : data.type === "security"
                ? null
                : "systemEnabled";

    if (preferenceKey && !preferences[preferenceKey]) {
      return null;
    }

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
