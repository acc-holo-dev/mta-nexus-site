import { notificationRepository, serverRepository, socialRepository } from "@nexus/db";
import type { Content } from "@nexus/domain";
import { generateId } from "@nexus/security";
import { buildServerPublicationNotification } from "../server-follow-notifications";

const MAX_SERVER_FOLLOWERS_PER_PUBLICATION = 100;
const SERVER_FOLLOW_NOTIFICATION_CONCURRENCY = 10;

export type ServerFollowerNotificationResult = Readonly<{
  eligibleFollowers: number;
  attempted: number;
  delivered: number;
  suppressedByPreference: number;
  failed: number;
  pushQueued: number;
  followerLimitReached: boolean;
  skipped: boolean;
}>;

function skippedResult(): ServerFollowerNotificationResult {
  return Object.freeze({
    eligibleFollowers: 0,
    attempted: 0,
    delivered: 0,
    suppressedByPreference: 0,
    failed: 0,
    pushQueued: 0,
    followerLimitReached: false,
    skipped: true,
  });
}

export async function notifyServerFollowersOfPublishedContent(
  content: Pick<Content, "authorId" | "serverId" | "slug" | "status" | "title">,
): Promise<ServerFollowerNotificationResult> {
  if (content.status !== "published" || !content.serverId) {
    return skippedResult();
  }

  try {
    const server = await serverRepository.findById(content.serverId);
    if (!server || server.visibility === "private" || server.status === "suspended") {
      return skippedResult();
    }

    const fetchedFollowers = await socialRepository.listFollowersByTarget(
      "server",
      server.id,
      MAX_SERVER_FOLLOWERS_PER_PUBLICATION + 2,
    );
    const eligibleFollowers = fetchedFollowers.filter(
      (follow) => follow.followerId !== content.authorId,
    );
    const followerLimitReached = eligibleFollowers.length > MAX_SERVER_FOLLOWERS_PER_PUBLICATION;
    const followers = eligibleFollowers.slice(0, MAX_SERVER_FOLLOWERS_PER_PUBLICATION);
    const notification = buildServerPublicationNotification(server, content);

    let delivered = 0;
    let suppressedByPreference = 0;
    let failed = 0;
    let pushQueued = 0;

    for (
      let offset = 0;
      offset < followers.length;
      offset += SERVER_FOLLOW_NOTIFICATION_CONCURRENCY
    ) {
      const batch = followers.slice(offset, offset + SERVER_FOLLOW_NOTIFICATION_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (follow) => {
          try {
            const created = await notificationRepository.createWithPushOutbox({
              id: generateId("not"),
              recipientId: follow.followerId,
              ...notification,
            });
            if (!created.notification) {
              return {
                inbox: "suppressed" as const,
                pushQueued: 0,
              };
            }

            return {
              inbox: "delivered" as const,
              pushQueued: created.pushJobs,
            };
          } catch {
            return {
              inbox: "failed" as const,
              pushQueued: 0,
            };
          }
        }),
      );

      for (const result of results) {
        if (result.inbox === "delivered") delivered += 1;
        else if (result.inbox === "suppressed") suppressedByPreference += 1;
        else failed += 1;

        pushQueued += result.pushQueued;
      }
    }

    return Object.freeze({
      eligibleFollowers: followers.length,
      attempted: followers.length,
      delivered,
      suppressedByPreference,
      failed,
      pushQueued,
      followerLimitReached,
      skipped: false,
    });
  } catch {
    return Object.freeze({
      eligibleFollowers: 0,
      attempted: 0,
      delivered: 0,
      suppressedByPreference: 0,
      failed: 1,
      pushQueued: 0,
      followerLimitReached: false,
      skipped: false,
    });
  }
}
