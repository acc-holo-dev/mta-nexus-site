import { resourceLibrarySelectionsRepository, resourceModerationRepository } from "@nexus/db";
import {
  ForbiddenError,
  type LibraryReleaseCommand,
  type LibraryReleaseHistoryQuery,
  type LibraryReleaseFilter,
  type ProductStatus,
  type ResourceModerationCommand,
  type User,
} from "@nexus/domain";
import { generateId } from "@nexus/security";
function moderator(user: User) {
  if (user.role !== "admin" && user.role !== "moderator") throw new ForbiddenError();
}
export const libraryReleaseService = {
  history: (user: User, query: LibraryReleaseHistoryQuery) =>
    resourceLibrarySelectionsRepository.history(user.id, query),
  page: (user: User, page = 1, filter: LibraryReleaseFilter = "all") =>
    resourceLibrarySelectionsRepository.page(user.id, page, filter),
  detail: (user: User, productId: string, page = 1) =>
    resourceLibrarySelectionsRepository.detail(user.id, productId, page),
  command: (user: User, productId: string, command: LibraryReleaseCommand) =>
    resourceLibrarySelectionsRepository.command({
      userId: user.id,
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
  command(user: User, productId: string, command: ResourceModerationCommand) {
    moderator(user);
    return resourceModerationRepository.command({
      actorId: user.id,
      productId,
      command,
      auditId: generateId("aud"),
    });
  },
};
