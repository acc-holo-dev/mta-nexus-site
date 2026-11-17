import { resourceBuildWorkspaceRepository } from "@nexus/db";
import type { ResourceBuildCommand, User } from "@nexus/domain";
import { generateId } from "@nexus/security";
export const resourceBuildWorkspaceService = {
  detail(productId: string, buildId: string, actor: User, staff = false) {
    return resourceBuildWorkspaceRepository.detail(productId, buildId, actor.id, staff);
  },
  command(productId: string, buildId: string, command: ResourceBuildCommand, actor: User) {
    return resourceBuildWorkspaceRepository.command({
      productId,
      buildId,
      command,
      actorId: actor.id,
      auditId: generateId("aud"),
    });
  },
};
