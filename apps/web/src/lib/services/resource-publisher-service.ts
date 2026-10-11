import { resourcePublisherRepository } from "@nexus/db";
import type { PublisherResourceQuery, PublisherHistoryKind, User } from "@nexus/domain";
export const resourcePublisherService = {
  inventory(actor: User, query: PublisherResourceQuery & { page: number }) {
    return resourcePublisherRepository.inventory(actor.id, query, query.page);
  },
  history(actor: User, productId: string, query: { page: number; kind: PublisherHistoryKind }) {
    return resourcePublisherRepository.history(productId, actor.id, query.kind, query.page);
  },
};
