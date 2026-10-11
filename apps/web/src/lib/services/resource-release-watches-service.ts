import { resourceReleaseWatchesRepository } from "@nexus/db";
import type { ResourceReleaseWatchCommand, ResourceReleaseWatchFilter, User } from "@nexus/domain";
import { generateId } from "@nexus/security";
export const resourceReleaseWatchesService = {
  detail: (user: User, productId: string) =>
    resourceReleaseWatchesRepository.detail(user.id, productId),
  page: (user: User, page: number, filter: ResourceReleaseWatchFilter) =>
    resourceReleaseWatchesRepository.page(user.id, page, filter),
  command: (user: User, productId: string, command: ResourceReleaseWatchCommand) =>
    resourceReleaseWatchesRepository.command({
      userId: user.id,
      productId,
      command,
      auditId: generateId("aud"),
    }),
};
