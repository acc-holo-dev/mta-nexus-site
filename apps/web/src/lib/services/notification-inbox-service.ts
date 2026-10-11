import { notificationRepository } from "@nexus/db";
import { AppError, type Notification } from "@nexus/domain";
import { safeExternalWebUrl } from "@nexus/validation";
import type { z } from "zod";
import { getDictionary, type Locale } from "../i18n";
import { formatNotification } from "../notification-copy";
import {
  INBOX_CATEGORIES,
  type NotificationInboxQuery,
  notificationInboxCommandSchema,
} from "../notification-inbox-contract";

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
class NotificationInboxService {
  async page(actorId: string, filters: NotificationInboxQuery, locale: Locale) {
    const page = await notificationRepository.pageInbox(actorId, filters);
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
  async command(actorId: string, value: z.infer<typeof notificationInboxCommandSchema>) {
    const parsed = notificationInboxCommandSchema.safeParse(value);
    if (!parsed.success) throw new AppError("Invalid selection", 400, "VALIDATION_ERROR");
    return notificationRepository.setInboxReadState(actorId, parsed.data);
  }
}
export const notificationInboxService = new NotificationInboxService();
