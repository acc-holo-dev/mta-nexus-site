import { serverContentRepository } from "@nexus/db";
import type { User, Content } from "@nexus/domain";
import { ValidationError } from "@nexus/domain";
import { authorContentService } from "./author-content-service";
import { editablePublication } from "./publication-editor-record";
import {
  editorialTypes,
  writerCreateSchema,
  type parseContentPage,
} from "../user-platform-contract";
class ServerContentService {
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
