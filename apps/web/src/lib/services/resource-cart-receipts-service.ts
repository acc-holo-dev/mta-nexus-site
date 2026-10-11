import { resourceCartReceiptsRepository } from "@nexus/db";
import type { ResourceCartReceiptQuery, User } from "@nexus/domain";
export const resourceCartReceiptsService = {
  page: (user: User, query: ResourceCartReceiptQuery) =>
    resourceCartReceiptsRepository.page(user.id, query),
  detail: (user: User, requestId: string) =>
    resourceCartReceiptsRepository.detail(user.id, requestId),
};
