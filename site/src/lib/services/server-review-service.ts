import { serverReviewsRepository } from "@nexus/db";
import {
  ForbiddenError,
  type ServerReviewCommand,
  type ServerReviewModeration,
  type User,
} from "@nexus/domain";
import { generateId } from "@nexus/security";

function staff(actor: User) {
  if (!["admin", "moderator"].includes(actor.role)) throw new ForbiddenError();
}

export const serverReviewService = {
  publicPage: (serverId: string, page = 1) => serverReviewsRepository.publicPage(serverId, page),
  ownDetail: (actor: User, serverId: string) =>
    serverReviewsRepository.ownDetail(actor.id, serverId),
  command: (actor: User, serverId: string, command: ServerReviewCommand) =>
    serverReviewsRepository.command({
      actorId: actor.id,
      serverId,
      reviewId: generateId("cmt"),
      auditId: generateId("aud"),
      command,
    }),
  moderate(actor: User, reviewId: string, command: ServerReviewModeration) {
    staff(actor);
    return serverReviewsRepository.moderate({
      actorId: actor.id,
      reviewId,
      auditId: generateId("aud"),
      command,
    });
  },
};
