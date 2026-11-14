import { organizationTeamDirectoryRepository } from "@nexus/db";
import { NotFoundError, type User } from "@nexus/domain";
import { safeExternalWebUrl } from "@nexus/validation";
import type { OrganizationTeamPage, OrganizationTeamQuery } from "../organization-team-contract";
import { editableOrganization } from "./organization-workspace-service";
class OrganizationTeamService {
  async page(
    id: string,
    actor: User,
    filters: OrganizationTeamQuery,
  ): Promise<OrganizationTeamPage> {
    if (!/^[a-zA-Z0-9_-]{1,128}$/u.test(id)) throw new NotFoundError("Organization");
    const result = await organizationTeamDirectoryRepository.page(id, actor.id, filters);
    const identity = (value: NonNullable<typeof result.owner>) => ({
      id: value.id,
      username: value.username,
      displayName: value.displayName,
      avatarUrl: safeExternalWebUrl(value.avatarUrl) ?? null,
    });
    return {
      organization: editableOrganization(result.organization),
      role: result.role as OrganizationTeamPage["role"],
      owner: result.owner ? identity(result.owner) : null,
      members: result.members.map((row) => ({
        ...identity(row),
        role: row.role,
        managesServers: row.managesServers,
        effectiveServerAccess: row.effectiveServerAccess,
        joinedAt: row.joinedAt.toISOString(),
      })),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor
        ? JSON.stringify({ ...result.nextCursor, context: result.context, version: 1 })
        : null,
    };
  }
}
export const organizationTeamService = new OrganizationTeamService();
