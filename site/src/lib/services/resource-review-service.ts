import { resourceReviewsRepository } from "@nexus/db";
import {
  ForbiddenError,
  type ResourceReviewCommand,
  type ResourceReviewDecision,
  type User,
} from "@nexus/domain";
import { generateId } from "@nexus/security";
function staff(actor: User) {
  if (!["admin", "moderator"].includes(actor.role)) throw new ForbiddenError();
}
export const resourceReviewService = {
  publicPage: (id: string, page = 1) => resourceReviewsRepository.publicPage(id, page),
  ownPage: (actor: User, page = 1) => resourceReviewsRepository.ownPage(actor.id, page),
  ownDetail: (actor: User, id: string) => resourceReviewsRepository.ownDetail(actor.id, id),
  command: (actor: User, id: string, command: ResourceReviewCommand) =>
    resourceReviewsRepository.command({
      actorId: actor.id,
      productId: id,
      reviewId: generateId("cmt"),
      auditId: generateId("aud"),
      command,
    }),
  report: (
    actor: User,
    productId: string,
    reviewId: string,
    data: { type: string; reason: string },
  ) =>
    resourceReviewsRepository.report({
      actorId: actor.id,
      productId,
      reviewId,
      id: generateId("rpt"),
      auditId: generateId("aud"),
      ...data,
    }),
  reportsPage(actor: User, isStaff: boolean, page = 1, view: "pending" | "history" = "pending") {
    if (isStaff) staff(actor);
    return resourceReviewsRepository.reportsPage({ actorId: actor.id, staff: isStaff }, page, view);
  },
  reportDetail(actor: User, isStaff: boolean, id: string) {
    if (isStaff) staff(actor);
    return resourceReviewsRepository.reportDetail({ actorId: actor.id, staff: isStaff }, id);
  },
  decide(actor: User, id: string, command: ResourceReviewDecision) {
    staff(actor);
    return resourceReviewsRepository.decide({
      actorId: actor.id,
      id,
      auditId: generateId("aud"),
      command,
    });
  },
};
