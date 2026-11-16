import { commercialPlanRepository, planReviewsRepository, sellerSalesRepository } from "@nexus/db";
import { AppError, type User } from "@nexus/domain";
import { planReviewCommandSchema } from "@nexus/validation";
import { planReviewId } from "../plan-reviews-query";
export const planReviewsService = {
  plan: (id: string) => commercialPlanRepository.published(planReviewId(id)),
  save(actor: User, input: unknown, currentToken: string) {
    const parsed = planReviewCommandSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid plan review", 400, "PLAN_REVIEW_INVALID");
    return planReviewsRepository.save(actor.id, parsed.data, currentToken);
  },
  page: (
    actor: User,
    query: { organizationId?: string; page: number; days: 7 | 30 | 90 | 365 | "all" },
  ) => planReviewsRepository.page(actor.id, query.organizationId, query.page, query.days),
  detail: (actor: User, id: string, organizationId?: string) =>
    planReviewsRepository.detail(actor.id, planReviewId(id), organizationId),
  scopes: (actor: User, page = 1) => sellerSalesRepository.scopes(actor.id, page),
};
