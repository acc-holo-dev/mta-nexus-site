import { organizationContentRepository } from "@nexus/db";
import type { User, Content } from "@nexus/domain";
import { editablePublication as editable } from "./publication-editor-record";
import { authorContentService } from "./author-content-service";
import type { parseContentPage } from "../user-platform-contract";

class OrganizationContentService {
  context(organizationId: string, actor: User) {
    return organizationContentRepository.context(organizationId, actor.id);
  }
  async page(organizationId: string, actor: User, filters: ReturnType<typeof parseContentPage>) {
    const result = await organizationContentRepository.page(organizationId, actor.id, filters);
    return {
      ...result,
      items: result.items.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() })),
    };
  }
  async get(organizationId: string, actor: User, id: string) {
    const result = await organizationContentRepository.get(organizationId, actor.id, id);
    return {
      organization: result.organization,
      content: editable(result.content as unknown as Content),
    };
  }
  async create(organizationId: string, actor: User, input: unknown) {
    return editable(await authorContentService.create(input, actor, organizationId));
  }
  async update(organizationId: string, actor: User, id: string, input: unknown, archive = false) {
    return editable(await authorContentService.update(id, input, actor, archive, organizationId));
  }
}
export const organizationContentService = new OrganizationContentService();
