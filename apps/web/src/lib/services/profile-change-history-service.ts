import { profileChangeHistoryRepository } from "@nexus/db";
import { AppError, type ChangeHistoryFilters, type ProfileChangeGroup } from "@nexus/domain";
import { encodeChangeHistoryCursor } from "../private-change-history-query";
import { profileChangeHistorySchema } from "../profile-change-history-contract";
export const profileChangeHistoryService = {
  async page(actorId: string, filters: ChangeHistoryFilters<ProfileChangeGroup>) {
    const result = await profileChangeHistoryRepository.page(actorId, filters);
    if (result.period !== filters.period || result.group !== filters.group)
      throw new AppError("Profile history scope changed", 503, "INTERNAL_ERROR");
    const value = {
      username: result.username,
      period: result.period,
      group: result.group,
      until: result.until,
      items: result.items.map((row) => ({
        id: row.id,
        action: row.action,
        createdAt: row.createdAt,
        fields: row.fields,
        experienceVerificationInvalidated: row.experienceVerificationInvalidated,
        actor: row.actor,
      })),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor ? encodeChangeHistoryCursor(result.nextCursor) : null,
    };
    const parsed = profileChangeHistorySchema.safeParse(value);
    if (!parsed.success) throw new AppError("Profile history unavailable", 503, "INTERNAL_ERROR");
    return parsed.data;
  },
};
