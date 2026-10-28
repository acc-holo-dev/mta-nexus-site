import { entitlementRepository, resourceCartRepository, orderRepository } from "@nexus/db";
import { generateId } from "@nexus/security";
import type { FreeResourceClaimResult, User } from "@nexus/domain";

/**
 * Closed-beta resource access service.
 *
 * The historical CommerceService export name is kept to avoid unnecessary
 * import churn, but paid checkout/license operations are intentionally absent.
 * Legacy database records remain readable through entitlement compatibility
 * logic in the repository layer.
 */
export class CommerceService {
  async getBuyerOrderDetails(user: User, orderId: string, page = 1) {
    return orderRepository.buyerDetails(orderId, user.id, page);
  }

  async getResourceCart(user: User) {
    return resourceCartRepository.get(user.id);
  }
  async reviewResourceCart(user: User) {
    return resourceCartRepository.review(user.id);
  }

  async addResourceToCart(user: User, productId: string, currentToken: string) {
    await resourceCartRepository.add(user.id, productId, currentToken);
  }

  async removeResourceFromCart(user: User, productId: string, currentToken: string) {
    await resourceCartRepository.remove(user.id, productId, currentToken);
  }

  async acquireResourceCart(
    user: User,
    productIds: string[],
    requestId: string,
    reviewDigest: string,
    currentToken: string,
  ) {
    return resourceCartRepository.acquire({
      userId: user.id,
      currentToken,
      productIds,
      requestId,
      reviewDigest,
      entitlementIds: productIds.map(() => generateId("ent")),
      auditId: generateId("aud"),
    });
  }

  async claimFreeResource(input: {
    user: User;
    productId: string;
    currentToken: string;
  }): Promise<FreeResourceClaimResult> {
    return entitlementRepository.claimFreeResource({
      entitlementId: generateId("ent"),
      userId: input.user.id,
      currentToken: input.currentToken,
      productId: input.productId,
    });
  }

  async checkEntitlement(
    subject: {
      type: "user" | "server" | "organization";
      id: string;
    },
    resourceId: string,
    permission: string,
  ): Promise<boolean> {
    return entitlementRepository.hasEntitlement(subject, resourceId, permission);
  }
}

export const commerceService = new CommerceService();
