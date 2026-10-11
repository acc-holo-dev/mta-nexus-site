import { createHash } from "node:crypto";
import type { Notification, NotificationCategory, NotificationPreferences } from "@nexus/domain";
import { AppError, NotFoundError } from "@nexus/domain";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../client";
import { notificationPreferences, notifications } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { containsPattern } from "./search-pattern";
import { enqueueWebPushOutboxForNotification } from "./web-push-outbox";

function boundedNotificationLimit(value: number, fallback: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(Math.floor(value), 1), maximum) : fallback;
}

export class NotificationRepository {
  async pageInbox(
    recipientId: string,
    filters: {
      query: string;
      state: "all" | "read" | "unread";
      category: string;
      cursor?: { createdAt: string; id: string; context: string; direction: "older" | "newer" };
    },
  ) {
    const context = createHash("sha256")
      .update(
        JSON.stringify([
          1,
          "notification-inbox",
          recipientId,
          filters.query,
          filters.state,
          filters.category,
        ]),
      )
      .digest("hex");
    if (filters.cursor && filters.cursor.context !== context)
      throw new AppError("Inbox context changed", 400, "INVALID_CURSOR");
    return db.transaction(
      async (tx) => {
        const pattern = filters.query ? containsPattern(filters.query) : undefined;
        const newer = filters.cursor?.direction === "newer";
        const rows = await tx
          .select({
            id: notifications.id,
            title: sql<string>`left(${notifications.title},512)`,
            message: sql<string>`left(${notifications.message},8192)`,
            link: sql<
              string | null
            >`case when length(${notifications.link}) <= 2048 then ${notifications.link} else null end`,
            data: sql<
              Notification["data"]
            >`case when octet_length(${notifications.data}::text) <= 16384 then ${notifications.data} else null end`,
            truncated: sql<boolean>`length(${notifications.title}) > 512 or length(${notifications.message}) > 8192 or coalesce(length(${notifications.link}) > 2048,false) or coalesce(octet_length(${notifications.data}::text) > 16384,false)`,
            category: notifications.category,
            isRead: notifications.isRead,
            createdAt: sql<string>`to_char(${notifications.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          })
          .from(notifications)
          .where(
            and(
              eq(notifications.recipientId, recipientId),
              filters.state === "unread"
                ? sql`${notifications.isRead} = false`
                : filters.state === "read"
                  ? sql`${notifications.isRead} = true`
                  : undefined,
              filters.category !== "all" ? eq(notifications.category, filters.category) : undefined,
              pattern
                ? or(ilike(notifications.title, pattern), ilike(notifications.message, pattern))
                : undefined,
              filters.cursor
                ? newer
                  ? sql`(${notifications.createdAt},${notifications.id}) > (${filters.cursor.createdAt}::timestamptz,${filters.cursor.id})`
                  : sql`(${notifications.createdAt},${notifications.id}) < (${filters.cursor.createdAt}::timestamptz,${filters.cursor.id})`
                : undefined,
            ),
          )
          .orderBy(
            newer ? asc(notifications.createdAt) : desc(notifications.createdAt),
            newer ? asc(notifications.id) : desc(notifications.id),
          )
          .limit(26);
        const items = rows.slice(0, 25);
        if (newer) items.reverse();
        const [unread] = await tx
          .select({ total: count() })
          .from(notifications)
          .where(
            and(eq(notifications.recipientId, recipientId), sql`${notifications.isRead} = false`),
          );
        const point = (
          item: (typeof items)[number] | undefined,
          direction: "older" | "newer",
          enabled: boolean,
        ) =>
          item && enabled
            ? JSON.stringify({
                createdAt: item.createdAt,
                id: item.id,
                context,
                direction,
                version: 1,
              })
            : null;
        return {
          items,
          unreadCount: unread?.total ?? 0,
          olderCursor: point(items.at(-1), "older", newer ? !!filters.cursor : rows.length > 25),
          newerCursor: point(items[0], "newer", newer ? rows.length > 25 : !!filters.cursor),
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async setInboxReadState(
    recipientId: string,
    command: { isRead: boolean; items: { id: string; expectedIsRead: boolean }[] },
  ) {
    // Validate at the storage boundary as well: no unbounded or accidental global update.
    if (
      typeof command.isRead !== "boolean" ||
      !Array.isArray(command.items) ||
      !command.items.length ||
      command.items.length > 25 ||
      new Set(command.items.map((item) => item.id)).size !== command.items.length
    )
      throw new AppError("Invalid inbox selection", 400, "VALIDATION_ERROR");
    return db.transaction(async (tx) => {
      const ids = command.items.map((item) => item.id).sort();
      const owned = await tx
        .select({ id: notifications.id, isRead: notifications.isRead })
        .from(notifications)
        .where(and(eq(notifications.recipientId, recipientId), inArray(notifications.id, ids)))
        .orderBy(asc(notifications.id))
        .for("update");
      if (owned.length !== ids.length) throw new NotFoundError("Notification");
      if (
        owned.some(
          (row) => command.items.find((item) => item.id === row.id)?.expectedIsRead !== row.isRead,
        )
      )
        throw new AppError("Notification changed", 409, "NOTIFICATION_STATE_CHANGED");
      const stored = await tx
        .update(notifications)
        .set({ isRead: command.isRead })
        .where(and(eq(notifications.recipientId, recipientId), inArray(notifications.id, ids)))
        .returning({ id: notifications.id });
      if (stored.length !== ids.length)
        throw new AppError("Notification changed", 409, "NOTIFICATION_STATE_CHANGED");
      return { ids: stored.map((row) => row.id), isRead: command.isRead };
    });
  }

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
    return db.transaction(async (tx) => {
      await lockNotificationPreferencesForUsers(tx, [userId]);
      const rows = await tx
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);
      const current =
        (rows[0] as unknown as NotificationPreferences | undefined) ??
        this.defaultPreferences(userId);
      const values = {
        ...current,
        ...updates,
        id: current.id || `npr_${userId}`,
        userId,
        updatedAt: new Date(),
      };
      const [stored] = await tx
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
      if (!stored) {
        throw new Error("Notification preferences update returned no row");
      }
      return stored as unknown as NotificationPreferences;
    });
  }
  async findById(id: string): Promise<Notification | null> {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);
    return (rows[0] as unknown as Notification | undefined) ?? null;
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
              // Keep the fixed predicate visible to generic plans using the partial index.
              sql`${notifications.isRead} = false`
            )
          : eq(notifications.recipientId, recipientId)
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(boundedNotificationLimit(limit, 50, 100));
    return rows as unknown as Notification[];
  }

  async listBuildReviewByBuildId(
    buildId: string,
    limit = 32,
  ): Promise<Notification[]> {
    const prefix = `ntf_build_review_${buildId}_`;
    const rows = await db
      .select()
      .from(notifications)
      .where(
        and(
          sql`left(${notifications.id}, ${prefix.length}) = ${prefix}`,
          sql`${notifications.data}->>'kind' = 'build_review'`,
        ),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(boundedNotificationLimit(limit, 32, 64));
    return rows as unknown as Notification[];
  }

  async countUnread(recipientId: string): Promise<number> {
    const [result] = await db
      .select({ total: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          sql`${notifications.isRead} = false`,
        ),
      );
    return result.total;
  }

  async createWithPushOutbox(
    data: Omit<Notification, "createdAt" | "isRead">,
  ): Promise<{
    notification: Notification | null;
    pushJobs: number;
    pushQueueState: "queued" | "no_subscriptions" | "saturated" | "error";
  }> {
    const category = data.category ?? (
      data.type === "order" || data.type === "license"
        ? "commerce"
        : data.type === "content"
          ? "content"
          : data.type === "server"
            ? "server"
            : data.type === "security"
              ? "security"
              : "system"
    ) as NotificationCategory;
    const preferenceKey =
      category === "follow"
        ? "followsEnabled"
        : category === "content"
          ? "contentEnabled"
          : category === "server"
            ? "serverEnabled"
            : category === "commerce"
              ? "commerceEnabled"
              : category === "system"
                ? "systemEnabled"
                : null;

    return await db.transaction(async (tx) => {
      await lockNotificationPreferencesForUsers(tx, [data.recipientId]);
      const preferenceRows = await tx
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, data.recipientId))
        .limit(1);
      const preferences =
        (preferenceRows[0] as unknown as NotificationPreferences | undefined) ??
        this.defaultPreferences(data.recipientId);

      if (preferenceKey && !preferences[preferenceKey]) {
        return {
          notification: null,
          pushJobs: 0,
          pushQueueState: "no_subscriptions" as const,
        };
      }

      const now = new Date();
      const values = {
        ...data,
        category,
        isRead: false,
        createdAt: now,
      };

      const [row] = await tx
        .insert(notifications)
        .values(values)
        .returning();
      if (!row) {
        throw new Error("Notification insert did not return a row");
      }

      let pushJobs = 0;
      let pushQueueState:
        | "queued"
        | "no_subscriptions"
        | "saturated"
        | "error" = "error";
      try {
        const queued = await tx.transaction((pushTx) =>
          enqueueWebPushOutboxForNotification(
            pushTx,
            row.id,
            row.recipientId,
          ),
        );
        pushJobs = queued.queued;
        pushQueueState = queued.reason;
      } catch {
        // Inbox is authoritative. A queue-local failure rolls back only
        // the savepoint and must not erase a successfully stored notification.
      }

      return {
        notification: row as unknown as Notification,
        pushJobs,
        pushQueueState,
      };
    });
  }

  async create(
    data: Omit<Notification, "createdAt" | "isRead">,
  ): Promise<Notification | null> {
    return (await this.createWithPushOutbox(data)).notification;
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
      .returning({ id: notifications.id });
    return rows.length > 0;
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          sql`${notifications.isRead} = false`,
        ),
      );
  }
}

export const notificationRepository = new NotificationRepository();
