import { organizationGovernanceRepository } from "@nexus/db";
import {
  AppError,
  type ChangeHistoryFilters,
  type OrganizationChangeGroup,
  type User,
} from "@nexus/domain";
import { generateId } from "@nexus/security";
import { safeExternalWebUrl } from "@nexus/validation";
import {
  organizationChangeHistorySchema,
  ownershipTransferSchema,
} from "../organization-governance-contract";
import { encodeChangeHistoryCursor } from "../private-change-history-query";
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
  async history(
    id: string,
    actor: User,
    before?: string,
    filters?: ChangeHistoryFilters<OrganizationChangeGroup>,
  ) {
    const result = await (filters
      ? organizationGovernanceRepository.history(id, actor.id, before, filters)
      : organizationGovernanceRepository.history(id, actor.id, before));
    if (
      filters &&
      (!("until" in result) ||
        result.period !== filters.period ||
        result.group !== filters.group ||
        result.query !== filters.query)
    )
      throw new AppError("History scope changed", 503, "INTERNAL_ERROR");
    const value = {
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
      items: result.items.map((row) => ({
        id: row.id,
        action: row.action,
        createdAt:
          typeof row.createdAt === "string" ? row.createdAt : (row.createdAt as Date).toISOString(),
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
      nextCursor:
        typeof result.nextCursor === "object" && result.nextCursor
          ? encodeChangeHistoryCursor(result.nextCursor)
          : result.nextCursor,
      ...("until" in result
        ? { until: result.until, period: result.period, group: result.group, query: result.query }
        : {}),
    };
    if (!filters) return value;
    const parsed = organizationChangeHistorySchema.safeParse(value);
    if (!parsed.success)
      throw new AppError("Organization history unavailable", 503, "INTERNAL_ERROR");
    return parsed.data;
  }
}
export const organizationGovernanceService = new OrganizationGovernanceService();
