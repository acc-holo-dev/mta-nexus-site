import type { Content, Notification, Server } from "@nexus/domain";

export type ServerPublicationNotification = Pick<
  Notification,
  "title" | "message" | "link" | "type" | "category"
>;

export function buildServerPublicationNotification(
  server: Pick<Server, "name">,
  content: Pick<Content, "title" | "slug">,
): ServerPublicationNotification {
  return Object.freeze({
    title: "New server update",
    message: `${server.name}: ${content.title}`,
    link: `/articles/${content.slug}`,
    type: "server",
    category: "server",
  });
}
