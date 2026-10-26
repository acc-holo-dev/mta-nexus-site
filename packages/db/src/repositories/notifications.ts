import { createHash } from "node:crypto";
import type { Notification, NotificationCategory, NotificationPreferences } from "@nexus/domain";
import { AppError, NotFoundError } from "@nexus/domain";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../client";
import { notificationPreferences, notifications } from "../schema";
import { discussionPushReceipt, withDiscussionPushReceipt } from "./discussion-push-receipt";
import { followWorkspaceRepository } from "./follow-workspace";
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
      period?: "all" | "7" | "30" | "90" | "365";
      at?: string;
      cursor?: {
        createdAt: string;
        id: string;
        context: string;
        direction: "older" | "newer";
        asOf?: string;
      };
    },
  ) {
    const period = filters.period ?? "all";
    const at = filters.at ?? filters.cursor?.asOf;
    const validTimestamp = (value: string) => {
      if (!/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(value)) return false;
      const parsed = new Date(value);
      return Number.isFinite(parsed.getTime()) && parsed.toISOString() === `${value.slice(0, 23)}Z`;
    };
    if (
      !["all", "7", "30", "90", "365"].includes(period) ||
      (at !== undefined && !validTimestamp(at)) ||
      (period === "all" && at !== undefined) ||
      (period !== "all" && filters.cursor && !filters.cursor.asOf) ||
      (filters.at && filters.cursor?.asOf && filters.at !== filters.cursor.asOf)
    )
      throw new AppError("Invalid inbox window", 400, "INVALID_CURSOR");
    const contextFor = (asOf?: string) =>
      createHash("sha256")
        .update(
          JSON.stringify([
            period === "all" ? 1 : 2,
            "notification-inbox",
            recipientId,
            filters.query,
            filters.state,
            filters.category,
            ...(period === "all" ? [] : [period, asOf]),
          ]),
        )
        .digest("hex");
    if (filters.cursor && filters.cursor.context !== contextFor(at))
      throw new AppError("Inbox context changed", 400, "INVALID_CURSOR");
    return db.transaction(
      async (tx) => {
        let window: { from: string; until: string } | undefined;
        if (period !== "all") {
          const anchor = sql`coalesce(${at ?? null}::timestamptz,statement_timestamp())`;
          // Parenthesize ${value}: bare `expr at time zone` binds AT TIME ZONE to an
          // interval operand when value is `anchor - n * interval '24 hours'`.
          const timestamp = (value: ReturnType<typeof sql>) =>
            sql<string>`to_char((${value}) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
          const [clock] = await tx
            .select({
              serverNow: timestamp(sql`statement_timestamp()`),
              from: timestamp(sql`${anchor} - ${Number(period)} * interval '24 hours'`),
              until: timestamp(anchor),
            })
            .from(sql`(select 1) as inbox_clock`);
          if (
            !clock ||
            !validTimestamp(clock.serverNow) ||
            !validTimestamp(clock.from) ||
            !validTimestamp(clock.until)
          )
            throw new AppError("Inbox clock unavailable", 503, "INTERNAL_ERROR");
          if (clock.until > clock.serverNow || clock.from > clock.until)
            throw new AppError("Inbox window is in the future", 400, "INVALID_CURSOR");
          window = { from: clock.from, until: clock.until };
        }
        const context = contextFor(window?.until);
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
              window
                ? sql`${notifications.createdAt} >= ${window.from}::timestamptz AND ${notifications.createdAt} <= ${window.until}::timestamptz`
                : undefined,
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
                ...(window ? { asOf: window.until } : {}),
              })
            : null;
        return {
          items,
          unreadCount: unread?.total ?? 0,
          olderCursor: point(items.at(-1), "older", newer ? !!filters.cursor : rows.length > 25),
          newerCursor: point(items[0], "newer", newer ? rows.length > 25 : !!filters.cursor),
          ...(window ? { window } : {}),
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
    >,
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
    const rows = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    return (rows[0] as unknown as Notification | undefined) ?? null;
  }

  async listByUser(recipientId: string, limit = 50, unreadOnly = false): Promise<Notification[]> {
    const rows = await db
      .select()
      .from(notifications)
      .where(
        unreadOnly
          ? and(
              eq(notifications.recipientId, recipientId),
              // Keep the fixed predicate visible to generic plans using the partial index.
              sql`${notifications.isRead} = false`,
            )
          : eq(notifications.recipientId, recipientId),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(boundedNotificationLimit(limit, 50, 100));
    return rows as unknown as Notification[];
  }

  async listBuildReviewByBuildId(buildId: string, limit = 32): Promise<Notification[]> {
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
      .where(and(eq(notifications.recipientId, recipientId), sql`${notifications.isRead} = false`));
    return result.total;
  }

  async createWithPushOutbox(data: Omit<Notification, "createdAt" | "isRead">): Promise<{
    notification: Notification | null;
    pushJobs: number;
    pushQueueState: "queued" | "no_subscriptions" | "saturated" | "error";
  }> {
    const category =
      data.category ??
      ((data.type === "order" || data.type === "license"
        ? "commerce"
        : data.type === "content"
          ? "content"
          : data.type === "server"
            ? "server"
            : data.type === "security"
              ? "security"
              : "system") as NotificationCategory);
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

      return this.persistWithin(tx, { ...data, category, isRead: false, createdAt: new Date() });
    });
  }

  private async persistWithin(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    values: Omit<Notification, "createdAt" | "isRead"> & {
      category: NotificationCategory;
      isRead: false;
      createdAt: Date;
    },
    idempotent = false,
  ) {
    const query = tx.insert(notifications).values(values);
    const [row] = await (idempotent ? query.onConflictDoNothing() : query).returning();
    if (!row) {
      if (idempotent)
        return { notification: null, pushJobs: 0, pushQueueState: "no_subscriptions" as const };
      throw new Error("Notification insert did not return a row");
    }

    let pushJobs = 0;
    let pushQueueState: "queued" | "no_subscriptions" | "saturated" | "error" = "error";
    try {
      const queued = await tx.transaction((pushTx) =>
        enqueueWebPushOutboxForNotification(pushTx, row.id, row.recipientId),
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
  }
  async createDiscussionReplyWithPush(input: {
    recipientId: string;
    contentId: string;
    commentId: string;
    repairPush?: boolean;
  }) {
    return db.transaction(async (tx) => {
      const source = await followWorkspaceRepository.discussionNoticeWithin(
        tx,
        input.recipientId,
        input.contentId,
        input.commentId,
      );
      if (!source)
        return {
          state: "skipped" as const,
          pushJobs: 0,
          pushQueueState: "no_subscriptions" as const,
        };
      await lockNotificationPreferencesForUsers(tx, [input.recipientId]);
      const [preferences] = await tx
        .select({
          follow: notificationPreferences.followsEnabled,
          content: notificationPreferences.contentEnabled,
        })
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, input.recipientId))
        .limit(1);
      const category =
        source.following && preferences?.follow !== false
          ? "follow"
          : source.direct && preferences?.content !== false
            ? "content"
            : null;
      if (!category)
        return {
          state: "suppressed" as const,
          pushJobs: 0,
          pushQueueState: "no_subscriptions" as const,
        };
      const stored = await this.persistDiscussionWithin(
        tx,
        {
          id: source.id,
          recipientId: input.recipientId,
          title: "New discussion reply",
          message:
            category === "follow"
              ? "A publication you follow has a new reply."
              : "A discussion you participate in has a new reply.",
          link: source.link,
          type: "content",
          category,
          isRead: false,
          createdAt: new Date(),
        },
        input.repairPush === true,
        [
          source.following && preferences?.follow !== false ? "follow" : null,
          source.direct && preferences?.content !== false ? "content" : null,
        ].filter((value) => value !== null),
      );
      return {
        state: stored.notification ? ("stored" as const) : ("duplicate" as const),
        pushJobs: stored.pushJobs,
        pushQueueState: stored.pushQueueState,
      };
    });
  }

  private async persistDiscussionWithin(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    values: Omit<Notification, "createdAt" | "isRead"> & {
      category: NotificationCategory;
      isRead: false;
      createdAt: Date;
    },
    repair: boolean,
    eligibleCategories: string[],
  ) {
    const [created] = await tx
      .insert(notifications)
      .values({
        ...values,
        createdAt: sql`clock_timestamp()`,
        data: withDiscussionPushReceipt("pending"),
      })
      .onConflictDoNothing()
      .returning();
    let row = created;
    if (!row && repair) {
      const [existing] = await tx
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.id, values.id),
            eq(notifications.recipientId, values.recipientId),
            eq(notifications.type, "content"),
            sql`${notifications.createdAt} + interval '24 hours' > clock_timestamp()`,
          ),
        )
        .for("update");
      if (
        existing &&
        !existing.isRead &&
        eligibleCategories.includes(existing.category) &&
        discussionPushReceipt(existing.data) === "pending"
      )
        row = existing;
    }
    if (!row)
      return { notification: null, pushJobs: 0, pushQueueState: "no_subscriptions" as const };
    let pushJobs = 0;
    let pushQueueState: "queued" | "no_subscriptions" | "saturated" | "error" = "error";
    try {
      const queued = await tx.transaction(async (pushTx) => {
        const admission = created
          ? await enqueueWebPushOutboxForNotification(pushTx, row.id, row.recipientId)
          : await enqueueWebPushOutboxForNotification(pushTx, row.id, row.recipientId, true);
        if (admission.reason !== "saturated") {
          const proof = await pushTx
            .update(notifications)
            .set({
              data: withDiscussionPushReceipt(
                admission.reason === "queued" ? "queued" : "unavailable",
              ),
            })
            .where(
              and(eq(notifications.id, row.id), eq(notifications.recipientId, row.recipientId)),
            )
            .returning({ id: notifications.id });
          if (proof.length !== 1) throw Error("Discussion push admission proof was not stored");
        }
        return admission;
      });
      pushJobs = queued.queued;
      pushQueueState = queued.reason;
    } catch {
      // Pending proof survives; optional jobs/proof roll back together at the savepoint.
    }
    return {
      notification: created ? (created as unknown as Notification) : null,
      pushJobs,
      pushQueueState,
    };
  }

  async create(data: Omit<Notification, "createdAt" | "isRead">): Promise<Notification | null> {
    return (await this.createWithPushOutbox(data)).notification;
  }

  async markAsRead(id: string, recipientId: string): Promise<boolean> {
    // Ownership enforcement: only the recipient can mark their own notification
    const rows = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.recipientId, recipientId)))
      .returning({ id: notifications.id });
    return rows.length > 0;
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.recipientId, recipientId), sql`${notifications.isRead} = false`));
  }
}

export const notificationRepository = new NotificationRepository();
