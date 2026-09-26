import { entitlementRepository } from "@nexus/db";
import { generateId } from "@nexus/security";
import type { Entitlement, User } from "@nexus/domain";

/**
 * Closed-beta resource access service.
 *
 * The historical CommerceService export name is kept to avoid unnecessary
 * import churn, but paid checkout/license operations are intentionally absent.
 * Legacy database records remain readable through entitlement compatibility
 * logic in the repository layer.
 */
export class CommerceService {
  async claimFreeResource(input: {
    user: User;
    productId: string;
  }): Promise<{ entitlement: Entitlement; alreadyClaimed: boolean }> {
    return entitlementRepository.claimFreeResource({
      entitlementId: generateId("ent"),
      userId: input.user.id,
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
    return entitlementRepository.hasEntitlement(
      subject,
      resourceId,
      permission,
    );
  }
}

export const commerceService = new CommerceService();
