import { resourceLibrarySelectionsRepository, resourceModerationRepository } from "@nexus/db";
import {
  ForbiddenError,
  type LibraryReleaseCommand,
  type LibraryReleaseComparisonQuery,
  type LibraryReleaseFilter,
  type LibraryReleaseHistoryQuery,
  type ProductStatus,
  type ResourceModerationCommand,
  type User,
} from "@nexus/domain";
import { generateId } from "@nexus/security";

function moderator(user: User) {
  if (user.role !== "admin" && user.role !== "moderator") throw new ForbiddenError();
}
export const libraryReleaseService = {
  compare: (user: User, productId: string, query: LibraryReleaseComparisonQuery) =>
    resourceLibrarySelectionsRepository.compare(user.id, productId, query),
  history: (user: User, query: LibraryReleaseHistoryQuery) =>
    resourceLibrarySelectionsRepository.history(user.id, query),
  page: (user: User, page = 1, filter: LibraryReleaseFilter = "all") =>
    resourceLibrarySelectionsRepository.page(user.id, page, filter),
  detail: (user: User, productId: string, page = 1) =>
    resourceLibrarySelectionsRepository.detail(user.id, productId, page),
  command: (user: User, productId: string, command: LibraryReleaseCommand, currentToken: string) =>
    resourceLibrarySelectionsRepository.command({
      userId: user.id,
      currentToken,
      productId,
      command,
      auditId: generateId("aud"),
    }),
};
export const resourceModerationService = {
  page(user: User, page = 1, status?: ProductStatus, query = "") {
    moderator(user);
    return resourceModerationRepository.page(user.id, page, status, query);
  },
  detail(user: User, productId: string, page = 1) {
    moderator(user);
    return resourceModerationRepository.detail(user.id, productId, page);
  },
  publisherHistory: (user: User, productId: string, page = 1) =>
    resourceModerationRepository.publisherHistory(user.id, productId, page),
  command(user: User, productId: string, command: ResourceModerationCommand, currentToken: string) {
    moderator(user);
    return resourceModerationRepository.command({
      actorId: user.id,
      productId,
      command,
      auditId: generateId("aud"),
      currentToken,
    });
  },
};
