import {
  commercialPlanRepository,
  financialStatementsRepository,
  subscriptionsRepository,
} from "@nexus/db";
import { AppError, type User } from "@nexus/domain";
import { subscriptionCommandSchema } from "@nexus/validation";
import { subscriptionId } from "../subscriptions-query";
export const subscriptionsService = {
  plan: (id: string) => commercialPlanRepository.published(subscriptionId(id)),
  scopes: (actor: User, page = 1) => financialStatementsRepository.scopes(actor.id, page),
  command(actor: User, input: unknown) {
    const parsed = subscriptionCommandSchema.safeParse(input);
    if (!parsed.success)
      throw new AppError("Invalid subscription command", 400, "SUBSCRIPTION_INVALID");
    return subscriptionsRepository.command(actor.id, parsed.data);
  },
  dashboard: (actor: User, organizationId?: string) =>
    subscriptionsRepository.dashboard(actor.id, organizationId),
  estimate: (
    actor: User,
    query: { organizationId?: string; amount: number; currency: "USD" | "EUR" | "RUB" },
  ) =>
    subscriptionsRepository.estimate(actor.id, query.organizationId, query.amount, query.currency),
  history: (
    actor: User,
    query: { organizationId?: string; page: number; days: 7 | 30 | 90 | 365 | "all" },
  ) => subscriptionsRepository.history(actor.id, query.organizationId, query.page, query.days),
  detail: (actor: User, id: string, organizationId?: string) =>
    subscriptionsRepository.detail(actor.id, subscriptionId(id), organizationId),
};
