import { resourceDeliveriesRepository } from "@nexus/db";
import type { ResourceDeliveryFinish, ResourceDeliveryQuery, User } from "@nexus/domain";
import { generateId } from "@nexus/security";
export const resourceDeliveriesService = {
  page: (user: User, query: ResourceDeliveryQuery) =>
    resourceDeliveriesRepository.page(user.id, query),
  detail: (user: User, receiptId: string) =>
    resourceDeliveriesRepository.detail(user.id, receiptId),
  publisher: (user: User, productId: string, query: Pick<ResourceDeliveryQuery, "days" | "page">) =>
    resourceDeliveriesRepository.publisher(productId, user.id, query),
  async finish(userId: string, receiptId: string, result: ResourceDeliveryFinish) {
    await resourceDeliveriesRepository.finish({
      userId,
      receiptId,
      result,
      auditId: generateId("aud"),
    });
  },
};
