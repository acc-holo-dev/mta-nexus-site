import { followWorkspaceRepository, socialRepository } from "@nexus/db";
import { safeExternalWebUrl } from "@nexus/validation";
import { encodeDiscussionCursor } from "../../../features/community/content-discussion-contract";
import type {
  FollowPage,
  FollowTargetType,
  ObjectMuteDuration,
  parseFollowQuery,
} from "../../../features/community/follow-workspace-contract";

const paths = {
  user: "/users",
  organization: "/organizations",
  server: "/servers",
  product: "/market",
  content: "/articles",
} as const;
class FollowWorkspaceService {
  async page(
    actorId: string,
    filters: NonNullable<ReturnType<typeof parseFollowQuery>>,
  ): Promise<FollowPage> {
    const result = await followWorkspaceRepository.page(actorId, filters);
    return {
      hasMore: result.hasMore,
      nextCursor: result.nextCursor ? encodeDiscussionCursor(result.nextCursor) : null,
      items: result.items.map((row) => ({
        id: row.id,
        targetId: row.targetId,
        targetType: row.targetType as keyof typeof paths,
        notifyComments: row.notifyComments,
        createdAt: row.createdAt.toISOString(),
        title: row.title,
        description: row.description,
        image: safeExternalWebUrl(row.image) ?? null,
        verified: row.verified,
        mutedUntil: row.mutedUntil ?? null,
        ...(row.targetType === "content" ? { discussion: row.discussion } : {}),
        href:
          row.handle && row.title
            ? `${paths[row.targetType as keyof typeof paths]}/${encodeURIComponent(row.handle)}`
            : null,
      })),
    };
  }

  muteState(actorId: string, targetType: FollowTargetType, targetId: string) {
    return followWorkspaceRepository.muteState(actorId, targetType, targetId);
  }

  contentStates(actorId: string, targetIds: readonly string[]) {
    return followWorkspaceRepository.contentStates(actorId, targetIds);
  }

  isFollowing(followerId: string, targetType: string, targetId: string) {
    return socialRepository.isFollowing(followerId, targetType, targetId);
  }

  setFollowingAuthenticated(
    ...args: Parameters<typeof followWorkspaceRepository.setFollowingAuthenticated>
  ) {
    return followWorkspaceRepository.setFollowingAuthenticated(...args);
  }

  setObjectMute(
    actorId: string,
    targetType: FollowTargetType,
    targetId: string,
    duration: ObjectMuteDuration | null,
    id: string,
    token: string,
  ) {
    return followWorkspaceRepository.setObjectMute(
      actorId,
      targetType,
      targetId,
      duration,
      id,
      token,
    );
  }
}
export const followWorkspaceService = new FollowWorkspaceService();
