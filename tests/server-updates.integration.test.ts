import { beforeAll, describe, expect, it } from "vitest";
import {
  contentRepository,
  serverRepository,
  userRepository,
} from "@nexus/db";

describe("published server update repository integration", () => {
  const suffix = `${Date.now().toString(36)}_${process.pid}`;
  const authorId = `usr_srv_feed_${suffix}`;
  const serverId = `srv_feed_${suffix}`;
  const otherServerId = `srv_feed_other_${suffix}`;
  const portBase = 10_000 + ((Date.now() + process.pid) % 40_000);

  beforeAll(async () => {
    await userRepository.create({
      id: authorId,
      email: `server_feed_${suffix}@nexus.test`,
      username: `server_feed_${suffix}`,
      displayName: "Server Feed Author",
      role: "server_owner",
    });

    await serverRepository.create({
      id: serverId,
      name: "Server Feed Target",
      slug: `server-feed-target-${suffix}`,
      ipAddress: "198.51.100.101",
      port: portBase,
      ownerId: authorId,
      status: "active",
      visibility: "public",
      isVerified: false,
      gameplayTags: [],
      mediaUrls: [],
    });
    await serverRepository.create({
      id: otherServerId,
      name: "Other Feed Target",
      slug: `server-feed-other-${suffix}`,
      ipAddress: "198.51.100.102",
      port: portBase + 1,
      ownerId: authorId,
      status: "active",
      visibility: "public",
      isVerified: false,
      gameplayTags: [],
      mediaUrls: [],
    });

    const base = {
      body: "Server feed integration content body",
      authorId,
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      tags: [],
    };

    await contentRepository.create({
      ...base,
      id: `cnt_feed_update_${suffix}`,
      title: "Published server update",
      slug: `published-server-update-${suffix}`,
      type: "update",
      serverId,
      status: "published",
      publishedAt: new Date(),
    });
    await contentRepository.create({
      ...base,
      id: `cnt_feed_post_${suffix}`,
      title: "Published community post",
      slug: `published-community-post-${suffix}`,
      type: "post",
      serverId,
      status: "published",
      publishedAt: new Date(),
    });
    await contentRepository.create({
      ...base,
      id: `cnt_feed_draft_${suffix}`,
      title: "Draft server update",
      slug: `draft-server-update-${suffix}`,
      type: "update",
      serverId,
      status: "draft",
    });
    await contentRepository.create({
      ...base,
      id: `cnt_feed_other_${suffix}`,
      title: "Other server update",
      slug: `other-server-update-${suffix}`,
      type: "update",
      serverId: otherServerId,
      status: "published",
      publishedAt: new Date(),
    });
  });

  it("returns only published moderated update types for the selected server", async () => {
    const rows = await contentRepository.listPublishedByServer(serverId, 6);

    expect(rows.map((row) => row.title)).toEqual([
      "Published server update",
    ]);
  });
});
