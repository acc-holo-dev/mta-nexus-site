import { supportMessageDiscoveryRepository } from "@nexus/db";
import { AppError, type SupportMessageFilters } from "@nexus/domain";
import { supportMessagePageSchema } from "../support-message-discovery-contract";
export const supportMessageDiscoveryService = {
  async page(caseId: string, actorId: string, filters: SupportMessageFilters, staffOnly = false) {
    const result = supportMessagePageSchema.safeParse(
      await supportMessageDiscoveryRepository.page(caseId, actorId, filters, staffOnly),
    );
    if (
      !result.success ||
      result.data.supportCase.id !== caseId ||
      result.data.focus !== (filters.focus ?? null) ||
      ((filters.cursor?.until ?? filters.until) !== undefined &&
        result.data.until !== (filters.cursor?.until ?? filters.until))
    )
      throw new AppError("Message data unavailable", 503, "INTERNAL_ERROR");
    return result.data;
  },
};
