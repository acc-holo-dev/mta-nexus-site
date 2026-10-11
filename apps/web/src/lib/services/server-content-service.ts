import { serverContentRepository } from "@nexus/db";
import type { Content, User } from "@nexus/domain";
import { ValidationError } from "@nexus/domain";
import {
  editorialTypes,
  type parseContentPage,
  writerCreateSchema,
} from "../user-platform-contract";
import { authorContentService } from "./author-content-service";
import { editablePublication } from "./publication-editor-record";

class ServerContentService {
  history(
    serverId: string,
    actor: User,
    id: string,
    filters: NonNullable<
      ReturnType<
        typeof import("../author-publication-desk-contract").parseAuthorPublicationHistoryQuery
      >
    >,
  ) {
    return authorContentService.history(id, actor, filters, undefined, serverId);
  }
  restore(serverId: string, actor: User, id: string, input: unknown) {
    return authorContentService.restore(id, input, actor, undefined, serverId);
  }

  context(serverId: string, actor: User) {
    return serverContentRepository.context(serverId, actor.id);
  }
  async page(serverId: string, actor: User, filters: ReturnType<typeof parseContentPage>) {
    const result = await serverContentRepository.page(serverId, actor.id, filters);
    return {
      ...result,
      items: result.items.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() })),
    };
  }
  async get(serverId: string, actor: User, id: string) {
    const result = await serverContentRepository.get(serverId, actor.id, id);
    return {
      server: result.server,
      content: editablePublication(result.content as unknown as Content),
    };
  }
  async create(serverId: string, actor: User, input: unknown) {
    const parsed = writerCreateSchema.safeParse(input);
    if (!parsed.success || !editorialTypes.some((type) => type === parsed.data.type))
      throw new ValidationError("Server editorial publication required");
    return editablePublication(
      await authorContentService.create(parsed.data, actor, undefined, serverId),
    );
  }
  async update(serverId: string, actor: User, id: string, input: unknown, archive = false) {
    return editablePublication(
      await authorContentService.update(id, input, actor, archive, undefined, serverId),
    );
  }
}
export const serverContentService = new ServerContentService();
