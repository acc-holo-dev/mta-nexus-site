import { beforeAll, describe, expect, it } from "vitest";
import {
  notificationRepository,
  serverRepository,
  socialRepository,
  userRepository,
} from "@nexus/db";
import { notifyServerFollowersOfPublishedContent } from "../apps/web/src/lib/services/server-follow-notification-service";

describe("server follower publication notification integration", () => {
  const suffix = `${Date.now().toString(36)}_${process.pid}`;
  const authorId = `usr_srv_author_${suffix}`;
  const enabledId = `usr_srv_notify_on_${suffix}`;
  const disabledId = `usr_srv_notify_off_${suffix}`;
  const serverId = `srv_notify_${suffix}`;
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
  });

  it("delivers only to eligible followers with server notifications enabled", async () => {
    const result = await notifyServerFollowersOfPublishedContent({
      authorId,
      serverId,
      slug: `server-update-${suffix}`,
      status: "published",
      title: "Integration update",
    });

    expect(result).toMatchObject({
      eligibleFollowers: 2,
      attempted: 2,
      delivered: 1,
      suppressedByPreference: 1,
      failed: 0,
      pushAttempted: 0,
      pushDelivered: 0,
      pushFailed: 0,
      pushStale: 0,
      followerLimitReached: false,
      skipped: false,
    });

    const enabledNotifications =
      await notificationRepository.listByUser(enabledId, 10);
    const disabledNotifications =
      await notificationRepository.listByUser(disabledId, 10);
    const authorNotifications =
      await notificationRepository.listByUser(authorId, 10);

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
  });
});
