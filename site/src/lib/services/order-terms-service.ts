import { orderTermsRepository } from "@nexus/db";
import type { User } from "@nexus/domain";
import { orderTermsId } from "../order-terms-query";
export const orderTermsService = {
  report: (actor: User, orderId: string, scope: "buyer" | "admin", page: number) =>
    orderTermsRepository.report(actor.id, orderTermsId(orderId), scope, page),
};
