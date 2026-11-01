import { resourceQaRepository } from "@nexus/db";
import type {
  ResourceQaAnswerCommand,
  ResourceQaAskCommand,
  ResourceQaFollowCommand,
  ResourceQaResolveCommand,
  User,
} from "@nexus/domain";
import { generateId } from "@nexus/security";

export const resourceQaService = {
  publicPage: (productId: string, page = 1, actor: User | null = null) =>
    resourceQaRepository.publicPage(productId, page, actor?.id ?? null),
  threadDetail: (productId: string, threadId: string, actor: User | null = null) =>
    resourceQaRepository.threadDetail(productId, threadId, actor?.id ?? null),
  ask: (actor: User, productId: string, command: ResourceQaAskCommand) =>
    resourceQaRepository.ask({
      actorId: actor.id,
      productId,
      threadId: generateId("rqt"),
      auditId: generateId("aud"),
      command,
    }),
  answer: (
    actor: User,
    productId: string,
    threadId: string,
    command: ResourceQaAnswerCommand,
  ) =>
    resourceQaRepository.answer({
      actorId: actor.id,
      productId,
      threadId,
      answerId: generateId("rqa"),
      auditId: generateId("aud"),
      command,
    }),
  resolve: (
    actor: User,
    productId: string,
    threadId: string,
    command: ResourceQaResolveCommand,
  ) =>
    resourceQaRepository.resolve({
      actorId: actor.id,
      productId,
      threadId,
      auditId: generateId("aud"),
      command,
    }),
  follow: (
    actor: User,
    productId: string,
    threadId: string,
    command: ResourceQaFollowCommand,
  ) =>
    resourceQaRepository.follow({
      actorId: actor.id,
      productId,
      threadId,
      auditId: generateId("aud"),
      command,
    }),
};
