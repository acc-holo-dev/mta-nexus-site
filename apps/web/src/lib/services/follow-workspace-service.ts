import { followWorkspaceRepository } from "@nexus/db";
import { safeExternalWebUrl } from "@nexus/validation";
import { encodeDiscussionCursor } from "../content-discussion-contract";
import type { FollowPage, parseFollowQuery } from "../follow-workspace-contract";
const paths = {
  user: "/users",
  organization: "/organizations",
  server: "/servers",
  product: "/market",
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
        createdAt: row.createdAt.toISOString(),
        title: row.title,
        description: row.description,
        image: safeExternalWebUrl(row.image) ?? null,
        verified: row.verified,
        href:
          row.handle && row.title
            ? `${paths[row.targetType as keyof typeof paths]}/${encodeURIComponent(row.handle)}`
            : null,
      })),
    };
  }
}
export const followWorkspaceService = new FollowWorkspaceService();
