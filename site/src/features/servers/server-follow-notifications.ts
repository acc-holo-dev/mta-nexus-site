import { type Content, type Notification, noticeStoredTitles, type Server } from "@nexus/domain";

export type ServerPublicationNotification = Pick<
  Notification,
  "title" | "message" | "link" | "type" | "category"
>;

export function buildServerPublicationNotification(
  server: Pick<Server, "name">,
  content: Pick<Content, "title" | "slug">,
): ServerPublicationNotification {
  return Object.freeze({
    title: noticeStoredTitles.newServerUpdate,
    message: `${server.name}: ${content.title}`,
    link: `/articles/${content.slug}`,
    type: "server",
    category: "server",
  });
}
