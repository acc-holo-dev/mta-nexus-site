import { resourceReleaseWatchesRepository } from "@nexus/db";
import type {
  ResourceReleaseWatchCommand,
  ResourceReleaseWatchHistoryQuery,
  ResourceReleaseWatchDisableCommand,
  ResourceReleaseWatchResumeCommand,
  ResourceReleaseWatchEnableCommand,
  ResourceReleaseWatchFilter,
  User,
} from "@nexus/domain";
import { generateId } from "@nexus/security";
export const resourceReleaseWatchesService = {
  history: (user: User, query: ResourceReleaseWatchHistoryQuery) =>
    resourceReleaseWatchesRepository.history(user.id, query),
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
    currentToken: string,
    collectionId: string,
    command: ResourceReleaseWatchEnableCommand,
  ) =>
    resourceReleaseWatchesRepository.enableCollectionBatch({
      userId: user.id,
      currentToken,
      collectionId,
      command,
      auditId: generateId("aud"),
    }),
  resumeBatch: (user: User, currentToken: string, command: ResourceReleaseWatchResumeCommand) =>
    resourceReleaseWatchesRepository.resumeBatch({
      userId: user.id,
      currentToken,
      command,
      auditId: generateId("aud"),
    }),
  disableBatch: (user: User, currentToken: string, command: ResourceReleaseWatchDisableCommand) =>
    resourceReleaseWatchesRepository.disableBatch({
      userId: user.id,
      currentToken,
      command,
      auditId: generateId("aud"),
    }),
  command: (
    user: User,
    currentToken: string,
    productId: string,
    command: ResourceReleaseWatchCommand,
  ) =>
    resourceReleaseWatchesRepository.command({
      userId: user.id,
      currentToken,
      productId,
      command,
      auditId: generateId("aud"),
    }),
};
