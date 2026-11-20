import { notificationRepository, webPushSubscriptionRepository } from "@nexus/db";
import { AppError, type Notification } from "@nexus/domain";
import { safeExternalWebUrl } from "@nexus/validation";
import type { z } from "zod";
import { formatNotification } from "../../../features/notifications/notification-copy";
import {
  INBOX_CATEGORIES,
  type NotificationInboxQuery,
  notificationInboxCommandSchema,
  notificationInboxPageSchema,
} from "../../../features/notifications/notification-inbox-contract";
import { getDictionary, type Locale } from "../../i18n";

function safeLink(value: string | null) {
  if (
    !value ||
    Array.from(value).some(
      (char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127 || char === "\\",
    )
  )
    return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return safeExternalWebUrl(value) ?? null;
}
const bounded = (value: string, maximum: number) => Array.from(value).slice(0, maximum).join("");
/** Format a server-side inbox snapshot without exposing its raw notification data. */
export function formatNotificationInboxPage(
  page: Awaited<ReturnType<typeof notificationRepository.pageInbox>>,
  locale: Locale,
) {
  return {
    ...page,
    items: page.items.map((item) => {
      const text = formatNotification(
        item as Pick<Notification, "title" | "message" | "data">,
        getDictionary(locale).buildReviewNotifications,
        locale,
      );
      return {
        id: item.id,
        title: bounded(text.title, 512),
        message: bounded(text.message, 8192),
        link: safeLink(item.link),
        category: (INBOX_CATEGORIES as readonly string[]).includes(item.category)
          ? (item.category as (typeof INBOX_CATEGORIES)[number])
          : ("system" as const),
        isRead: item.isRead,
        createdAt: item.createdAt,
        truncated:
          item.truncated ||
          Array.from(text.title).length > 512 ||
          Array.from(text.message).length > 8192,
      };
    }),
  };
}
class NotificationInboxService {
  async page(actorId: string, filters: NotificationInboxQuery, locale: Locale) {
    const page = await notificationRepository.pageInbox(actorId, filters);
    return formatNotificationInboxPage(page, locale);
  }
  async exportPage(actorId: string, filters: NotificationInboxQuery, locale: Locale) {
    const page = notificationInboxPageSchema.parse(await this.page(actorId, filters, locale));
    const report = {
      version: 1,
      scope: "notification-inbox-page",
      locale,
      filters: {
        query: filters.query,
        state: filters.state,
        category: filters.category,
        period: filters.period ?? "all",
      },
      window: page.window ?? null,
      items: page.items.map(({ id, title, message, category, isRead, createdAt, truncated }) => ({
        id,
        title,
        message,
        category,
        isRead,
        createdAt,
        truncated,
      })),
      hasOlder: !!page.olderCursor,
      hasNewer: !!page.newerCursor,
    };
    if (Buffer.byteLength(JSON.stringify(report), "utf8") > 1024 * 1024)
      throw new AppError("Inbox export exceeds byte limit", 413, "EXPORT_TOO_LARGE");
    return report;
  }
  async command(actorId: string, value: z.infer<typeof notificationInboxCommandSchema>) {
    const parsed = notificationInboxCommandSchema.safeParse(value);
    if (!parsed.success) throw new AppError("Invalid selection", 400, "VALIDATION_ERROR");
    return notificationRepository.setInboxReadState(actorId, parsed.data);
  }

  listByUser(userId: string, limit: number, unreadOnly: boolean) {
    return notificationRepository.listByUser(userId, limit, unreadOnly);
  }

  countUnread(userId: string) {
    return notificationRepository.countUnread(userId);
  }

  markAsRead(id: string, recipientId: string) {
    return notificationRepository.markAsRead(id, recipientId);
  }

  markAllAsRead(recipientId: string) {
    return notificationRepository.markAllAsRead(recipientId);
  }

  getPreferences(userId: string) {
    return notificationRepository.getPreferences(userId);
  }

  updatePreferences(
    userId: string,
    changes: Parameters<typeof notificationRepository.updatePreferences>[1],
    currentToken: string,
  ) {
    return notificationRepository.updatePreferences(userId, changes, currentToken);
  }

  listWebPushForSession(userId: string, sessionId: string) {
    return webPushSubscriptionRepository.listForSession(userId, sessionId);
  }

  upsertWebPushAuthenticated(
    ...args: Parameters<typeof webPushSubscriptionRepository.upsertAuthenticated>
  ) {
    return webPushSubscriptionRepository.upsertAuthenticated(...args);
  }

  removeWebPushAuthenticated(
    ...args: Parameters<typeof webPushSubscriptionRepository.removeAuthenticated>
  ) {
    return webPushSubscriptionRepository.removeAuthenticated(...args);
  }
}
export const notificationInboxService = new NotificationInboxService();
