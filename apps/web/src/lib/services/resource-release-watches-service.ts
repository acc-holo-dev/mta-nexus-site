import { resourceReleaseWatchesRepository } from "@nexus/db";
import type {
  ResourceReleaseWatchCommand,
  ResourceReleaseWatchDisableCommand,
  ResourceReleaseWatchEnableCommand,
  ResourceReleaseWatchFilter,
  User,
} from "@nexus/domain";
import { generateId } from "@nexus/security";
export const resourceReleaseWatchesService = {
  detail: (user: User, productId: string) =>
    resourceReleaseWatchesRepository.detail(user.id, productId),
  page: (user: User, page: number, filter: ResourceReleaseWatchFilter, query = "") =>
    resourceReleaseWatchesRepository.page(user.id, page, filter, query),
  collectionPage: (
    user: User,
    collectionId: string,
    page: number,
    filter: ResourceReleaseWatchFilter,
    query = "",
  ) => resourceReleaseWatchesRepository.collectionPage(user.id, collectionId, page, filter, query),
  enableCollectionBatch: (
    user: User,
    collectionId: string,
    command: ResourceReleaseWatchEnableCommand,
  ) =>
    resourceReleaseWatchesRepository.enableCollectionBatch({
      userId: user.id,
      collectionId,
      command,
      auditId: generateId("aud"),
    }),
  disableBatch: (user: User, command: ResourceReleaseWatchDisableCommand) =>
    resourceReleaseWatchesRepository.disableBatch({
      userId: user.id,
      command,
      auditId: generateId("aud"),
    }),
  command: (user: User, productId: string, command: ResourceReleaseWatchCommand) =>
    resourceReleaseWatchesRepository.command({
      userId: user.id,
      productId,
      command,
      auditId: generateId("aud"),
    }),
};
