import { organizationGovernanceRepository } from "@nexus/db";
import { AppError, type User } from "@nexus/domain";
import { generateId } from "@nexus/security";
import { safeExternalWebUrl } from "@nexus/validation";
import { ownershipTransferSchema } from "../organization-governance-contract";
import { editableOrganization } from "./organization-workspace-service";

class OrganizationGovernanceService {
  async transfer(id: string, actor: User, input: unknown) {
    const parsed = ownershipTransferSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid transfer", 400, "VALIDATION_ERROR");
    const result = await organizationGovernanceRepository.transfer({
      ...parsed.data,
      expectedUpdatedAt: new Date(parsed.data.expectedUpdatedAt),
      id,
      actorId: actor.id,
      memberId: generateId("mem"),
      auditId: generateId("aud"),
    });
    return {
      organization: editableOrganization(result.organization),
      role: result.role,
      owner: {
        id: result.owner.id,
        username: result.owner.username,
        displayName: result.owner.displayName,
        avatarUrl: safeExternalWebUrl(result.owner.avatarUrl) ?? null,
      },
      previousOwnerId: result.previousOwnerId,
    };
  }
  async history(id: string, actor: User, before?: string) {
    const result = await organizationGovernanceRepository.history(id, actor.id, before);
    return {
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
      items: result.items.map((row) => ({
        id: row.id,
        action: row.action,
        createdAt: row.createdAt.toISOString(),
        actorUsername: row.actorUsername,
        actorName: row.actorName,
        subjectUsername: row.subjectUsername,
        subjectName: row.subjectName,
        fromRole: row.fromRole,
        toRole: row.toRole,
        managesServers: row.managesServers,
        fields: row.fields,
      })),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    };
  }
}
export const organizationGovernanceService = new OrganizationGovernanceService();
