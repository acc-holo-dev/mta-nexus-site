import { resourceCompatibilityRepository, resourceVariantsRepository } from "@nexus/db";
import type { Product, ResourceVariantCommand, User } from "@nexus/domain";
import { generateId } from "@nexus/security";
import { isWalletEngineEnabled } from "../commerce/wallet-payment-service";

export const resourceManagementService = {
  publicVariants(productId: string) {
    return resourceVariantsRepository.publicVariants(productId, {
      allowPaid: isWalletEngineEnabled(),
    });
  },
  managedVariants(productId: string, actor: User) {
    return resourceVariantsRepository.managed(productId, actor, {
      allowPaid: isWalletEngineEnabled(),
    });
  },
  variantCandidates(productId: string, actor: User, page: number) {
    return resourceVariantsRepository.candidates(productId, actor, page, {
      allowPaid: isWalletEngineEnabled(),
    });
  },
  saveVariants(productId: string, actor: User, command: ResourceVariantCommand) {
    return resourceVariantsRepository.command({
      productId,
      actorId: actor.id,
      command,
      groupId: generateId("vgrp"),
      auditId: generateId("aud"),
      allowPaid: isWalletEngineEnabled(),
    });
  },
  updateCompatibility(
    productId: string,
    actor: User,
    input: { expectedUpdatedAt: string; compatibility: Product["compatibility"] },
  ) {
    return resourceCompatibilityRepository.update({
      ...input,
      productId,
      actorId: actor.id,
      auditId: generateId("aud"),
    });
  },
};
