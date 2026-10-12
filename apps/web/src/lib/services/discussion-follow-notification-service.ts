import { followWorkspaceRepository, notificationRepository } from "@nexus/db";
/** Finite event-time audience, bounded pages/concurrency, idempotent inbox deliveries. */
export async function notifyDiscussionReplies(contentId: string, commentId: string) {
  const result = {
    attempted: 0,
    stored: 0,
    suppressed: 0,
    duplicate: 0,
    skipped: 0,
    failed: 0,
    pushQueued: 0,
    pushDegraded: 0,
  };
  async function deliver(recipients: string[]) {
    for (let offset = 0; offset < recipients.length; offset += 10) {
      const batch = await Promise.allSettled(
        recipients.slice(offset, offset + 10).map(async (recipientId) =>
          notificationRepository.createDiscussionReplyWithPush({
            recipientId,
            contentId,
            commentId,
          }),
        ),
      );
      for (const item of batch) {
        result.attempted++;
        if (item.status === "rejected") {
          result.failed++;
          continue;
        }
        result[item.value.state]++;
        result.pushQueued += item.value.pushJobs;
        if (["saturated", "error"].includes(item.value.pushQueueState)) result.pushDegraded++;
      }
    }
  }
  try {
    const audience = await followWorkspaceRepository.discussionAudience(contentId, commentId);
    if (!audience) {
      result.skipped++;
      return result;
    }
    await deliver(audience.directRecipients);
    let cursor: { createdAt: string; id: string } | undefined;
    do {
      const page = await followWorkspaceRepository.discussionFollowers(
        contentId,
        audience.createdAt,
        [audience.authorId, ...audience.directRecipients],
        cursor,
      );
      await deliver(page.items.map((item) => item.recipientId));
      if (
        page.nextCursor &&
        cursor &&
        (page.nextCursor.createdAt < cursor.createdAt ||
          (page.nextCursor.createdAt === cursor.createdAt && page.nextCursor.id <= cursor.id))
      )
        throw Error("Discussion follower cursor did not advance");
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  } catch {
    result.failed++;
  }
  return result;
}
