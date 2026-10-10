import { resourceActivityRepository } from "@nexus/db";
import type { ResourceActivityDays, User } from "@nexus/domain";

export class ResourceActivityService {
  buyerHistory(actor: User, page = 1, source: "all" | "direct" | "cart" = "all") {
    return resourceActivityRepository.buyerHistory(actor.id, page, source);
  }
  publisherReport(actor: User, productId: string, days: ResourceActivityDays = 30) {
    return resourceActivityRepository.publisherReport(actor.id, productId, days);
  }
}
export const resourceActivityService = new ResourceActivityService();
