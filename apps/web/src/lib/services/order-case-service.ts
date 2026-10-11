import { orderCasesRepository } from "@nexus/db";
import { generateId } from "@nexus/security";
import type {
  OrderCaseCreate,
  OrderCaseReview,
  OrderCaseReviewStatus,
  SupportCaseStatus,
  User,
} from "@nexus/domain";
export const orderCaseService = {
  orderDetail(orderId: string, actor: User) {
    return orderCasesRepository.orderDetail(orderId, actor.id);
  },
  detail(caseId: string, actor: User, staff = false, page = 1) {
    return orderCasesRepository.detail(caseId, actor.id, staff, page);
  },
  page(
    actor: User,
    staff = false,
    page = 1,
    filter: { reviewStatus?: OrderCaseReviewStatus; threadStatus?: SupportCaseStatus } = {},
  ) {
    return orderCasesRepository.page(actor.id, staff, page, filter);
  },
  create(orderId: string, command: OrderCaseCreate, actor: User) {
    return orderCasesRepository.create({
      orderId,
      command,
      actorId: actor.id,
      caseId: generateId("sup"),
      messageId: generateId("spm"),
      auditId: generateId("aud"),
    });
  },
  review(caseId: string, command: OrderCaseReview, actor: User) {
    return orderCasesRepository.review({
      caseId,
      command,
      actorId: actor.id,
      auditId: generateId("aud"),
      statusAuditId: generateId("aud"),
      messageId: generateId("spm"),
    });
  },
};
