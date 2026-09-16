import { entitlementRepository, licenseRepository } from "@nexus/db";
import { generateId } from "@nexus/security";
import { AppError } from "@nexus/domain";
import type { Entitlement, License, User } from "@nexus/domain";

export class CommerceService {
  async createOrderAndCheckout(): Promise<never> {
    throw new AppError(
      "Paid checkout is unavailable until a real payment provider is configured",
      503,
      "PAYMENTS_NOT_CONFIGURED"
    );
  }

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

  async getUserLicenses(userId: string): Promise<License[]> {
    return licenseRepository.listByUser(userId);
  }

  async verifyLicense(
    key: string,
    serverId?: string
  ): Promise<{ valid: boolean; license?: License; reason?: string }> {
    const license = await licenseRepository.findByKey(key);
    if (!license) return { valid: false, reason: "Invalid license key" };
    if (license.status !== "active") return { valid: false, reason: `License is ${license.status}` };
    if (license.expiresAt && license.expiresAt < new Date()) {
      return { valid: false, reason: "License has expired" };
    }
    if (license.serverId && serverId && license.serverId !== serverId) {
      return { valid: false, reason: "License is locked to a different server identity" };
    }

    return { valid: true, license };
  }

  async checkEntitlement(
    subject: { type: "user" | "server" | "organization"; id: string },
    resourceId: string,
    permission: string
  ): Promise<boolean> {
    return entitlementRepository.hasEntitlement(subject, resourceId, permission);
  }
}

export const commerceService = new CommerceService();
