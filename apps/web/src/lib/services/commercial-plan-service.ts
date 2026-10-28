import { commercialPlanRepository, orderOperationsRepository } from "@nexus/db";
import {
  AppError,
  type CommercialCurrency,
  type CommercialPlanCommand,
  type CommercialPlanStatus,
  commercialFeeEstimate,
  ForbiddenError,
  type OrderCancellationCommand,
  type User,
} from "@nexus/domain";
import { generateId } from "@nexus/security";

function admin(user: User) {
  if (user.role !== "admin") throw new ForbiddenError();
}
export const commercialPlanService = {
  catalog: (scope: "user" | "organization", page = 1) =>
    commercialPlanRepository.catalog(scope, page),
  async estimate(
    amount: number,
    currency: CommercialCurrency,
    planId?: string,
    expectedRevision?: number,
  ) {
    const plan = planId ? await commercialPlanRepository.published(planId) : null;
    if (planId && (!plan || plan.revision !== expectedRevision))
      throw new AppError("Published plan changed", 409, "COMMERCIAL_PLAN_QUOTE_CHANGED");
    return {
      ...commercialFeeEstimate(amount, currency, plan?.commissionBps),
      plan: plan ? { id: plan.id, revision: plan.revision, scope: plan.scope } : null,
    };
  },
  adminPage(user: User, page = 1, status?: CommercialPlanStatus) {
    admin(user);
    return commercialPlanRepository.adminPage(user.id, page, status);
  },
  adminDetail(user: User, id: string, page = 1) {
    admin(user);
    return commercialPlanRepository.adminDetail(user.id, id, page);
  },
  command(user: User, command: CommercialPlanCommand, currentToken: string, id?: string) {
    admin(user);
    if ((command.action === "create") === !!id)
      throw new AppError("Invalid commercial plan command", 400, "COMMERCIAL_PLAN_INVALID");
    return commercialPlanRepository.command({
      actorId: user.id,
      currentToken,
      planId: id ?? generateId("cplan"),
      auditId: generateId("aud"),
      command,
    });
  },
};
export const orderOperationsService = {
  detail: (user: User, orderId: string, page = 1) =>
    orderOperationsRepository.buyerDetail(user.id, orderId, page),
  cancel: (user: User, orderId: string, command: OrderCancellationCommand) =>
    orderOperationsRepository.cancel({
      buyerId: user.id,
      orderId,
      command,
      auditId: generateId("aud"),
    }),
};
