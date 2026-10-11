import { sellerSalesRepository } from "@nexus/db";
import type { SellerSalesQuery, User } from "@nexus/domain";
import { sellerSalesId } from "../seller-sales-query";
export const sellerSalesService = {
  report: (actor: User, query: SellerSalesQuery) => sellerSalesRepository.report(actor.id, query),
  scopes: (actor: User, page: number) => sellerSalesRepository.scopes(actor.id, page),
  detail: (actor: User, itemId: string, organizationId?: string) =>
    sellerSalesRepository.detail(
      actor.id,
      sellerSalesId(itemId),
      organizationId === undefined ? undefined : sellerSalesId(organizationId),
    ),
};
