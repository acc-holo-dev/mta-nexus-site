import { beforeAll, describe, expect, it } from "vitest";
import {
  contentRepository,
  db,
  notificationRepository,
  publicationNotificationDeliveries,
  publicationNotificationDeliveryRepository,
  serverRepository,
  socialRepository,
  userRepository,
} from "@nexus/db";
import { drainPublicationNotificationDelivery } from "../apps/web/src/lib/services/server-follow-notification-service";

describe("server follower publication notification integration", () => {
  const suffix = `${Date.now().toString(36)}_${process.pid}`;
  const authorId = `usr_srv_author_${suffix}`;
  const enabledId = `usr_srv_notify_on_${suffix}`;
  const disabledId = `usr_srv_notify_off_${suffix}`;
  const serverId = `srv_notify_${suffix}`;
  const contentId = `cnt_notify_${suffix}`;
  const serverPort = 20_000 + ((Date.now() + process.pid) % 40_000);

  beforeAll(async () => {
    await userRepository.create({
      id: authorId,
      email: `server_author_${suffix}@nexus.test`,
      username: `srv_author_${suffix}`,
      displayName: "Server Update Author",
      role: "server_owner",
    });
    await userRepository.create({
      id: enabledId,
      email: `server_notify_on_${suffix}@nexus.test`,
      username: `srv_on_${suffix}`,
      displayName: "Server Follower Enabled",
      role: "user",
    });
    await userRepository.create({
      id: disabledId,
      email: `server_notify_off_${suffix}@nexus.test`,
      username: `srv_off_${suffix}`,
      displayName: "Server Follower Disabled",
      role: "user",
    });

    await serverRepository.create({
      id: serverId,
      name: "Notification Integration Server",
      slug: `notification-integration-${suffix}`,
      ipAddress: "198.51.100.75",
      port: serverPort,
      ownerId: authorId,
      status: "active",
      visibility: "public",
      isVerified: false,
      gameplayTags: [],
      mediaUrls: [],
    });

    await socialRepository.follow({
      id: `fol_author_${suffix}`,
      followerId: authorId,
      targetType: "server",
      targetId: serverId,
    });
    await socialRepository.follow({
      id: `fol_on_${suffix}`,
      followerId: enabledId,
      targetType: "server",
      targetId: serverId,
    });
    await socialRepository.follow({
      id: `fol_off_${suffix}`,
      followerId: disabledId,
      targetType: "server",
      targetId: serverId,
    });

    await notificationRepository.updatePreferences(disabledId, {
      serverEnabled: false,
    });

    await contentRepository.create({
      id: contentId,
      authorId,
      serverId,
      slug: `server-update-${suffix}`,
      title: "Integration update",
      body: "Body",
      type: "update",
      status: "published",
      publishedAt: new Date(),
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      tags: [],
    });

    await db.insert(publicationNotificationDeliveries).values({
      contentId,
      serverId,
      authorId,
      createdAt: new Date(),
    });
  });

  it("delivers only to eligible followers with server notifications enabled", async () => {
    const pages = await drainPublicationNotificationDelivery();
    expect(pages.some((page) => page.state === "completed")).toBe(true);
    expect(
      pages.reduce((sum, page) => sum + page.stored, 0),
    ).toBeGreaterThanOrEqual(1);

    const enabledNotifications = await notificationRepository.listByUser(enabledId, 10);
    const disabledNotifications = await notificationRepository.listByUser(disabledId, 10);
    const authorNotifications = await notificationRepository.listByUser(authorId, 10);

    expect(enabledNotifications).toHaveLength(1);
    expect(enabledNotifications[0]).toMatchObject({
      type: "server",
      category: "server",
      title: "New server update",
      message: "Notification Integration Server: Integration update",
      link: `/articles/server-update-${suffix}`,
    });
    expect(disabledNotifications).toHaveLength(0);
    expect(authorNotifications).toHaveLength(0);

    const idle = await publicationNotificationDeliveryRepository.processNext();
    expect(idle.state).toBe("idle");
  });
});
