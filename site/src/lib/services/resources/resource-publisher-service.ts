import { resourcePublisherRepository } from "@nexus/db";
import type { PublisherHistoryKind, PublisherResourceQuery, User } from "@nexus/domain";
import { isWalletEngineEnabled } from "../commerce/wallet-payment-service";

export const resourcePublisherService = {
  inventory(actor: User, query: PublisherResourceQuery & { page: number }) {
    return resourcePublisherRepository.inventory(actor.id, query, query.page, {
      allowPaid: isWalletEngineEnabled(),
    });
  },
  history(actor: User, productId: string, query: { page: number; kind: PublisherHistoryKind }) {
    return resourcePublisherRepository.history(productId, actor.id, query.kind, query.page);
  },
};
