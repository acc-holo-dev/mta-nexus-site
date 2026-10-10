import { resourceCompatibilityRepository, resourceVariantsRepository } from "@nexus/db";
import type { Product, ResourceVariantCommand, User } from "@nexus/domain";
import { generateId } from "@nexus/security";

export const resourceManagementService = {
  publicVariants(productId: string) {
    return resourceVariantsRepository.publicVariants(productId);
  },
  managedVariants(productId: string, actor: User) {
    return resourceVariantsRepository.managed(productId, actor);
  },
  variantCandidates(productId: string, actor: User, page: number) {
    return resourceVariantsRepository.candidates(productId, actor, page);
  },
  saveVariants(productId: string, actor: User, command: ResourceVariantCommand) {
    return resourceVariantsRepository.command({
      productId,
      actorId: actor.id,
      command,
      groupId: generateId("vgrp"),
      auditId: generateId("aud"),
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
