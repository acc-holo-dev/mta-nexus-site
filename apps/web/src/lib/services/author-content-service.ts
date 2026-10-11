import { authorContentRepository, contentRepository, organizationContentRepository } from "@nexus/db";
import { AppError, NotFoundError, ValidationError } from "@nexus/domain";
import type { User } from "@nexus/domain";
import { generateId } from "@nexus/security";
import { safeExternalWebUrl } from "@nexus/validation";
import {
  writerCreateSchema,
  writerUpdateSchema,
  writerArchiveSchema,
} from "../user-platform-contract";

class AuthorContentService {
  async get(id: string, actor: User) {
    const item = await authorContentRepository.findAuthored(id, actor.id);
    if (!item) throw new NotFoundError("Content");
    return {
      ...item,
      coverImageUrl: safeExternalWebUrl(item.coverImageUrl) ? item.coverImageUrl : undefined,
    };
  }
  async create(input: unknown, actor: User, organizationId?: string) {
    const parsed = writerCreateSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Invalid publication");
    const status =
      parsed.data.type === "post" || parsed.data.type === "question" ? "published" : "draft";
    const id = generateId("cnt");
    try {
      const save = organizationId
        ? (data: Parameters<typeof contentRepository.createWithAudit>[0], audit: Parameters<typeof contentRepository.createWithAudit>[1]) => organizationContentRepository.create(organizationId, actor.id, data, audit)
        : contentRepository.createWithAudit.bind(contentRepository);
      return await save(
        {
          ...parsed.data,
          id,
          authorId: actor.id,
          ...(organizationId ? { organizationId } : {}),
          status,
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
          ...(status === "published" ? { publishedAt: new Date() } : {}),
        },
        {
          id: generateId("aud"),
          actorId: actor.id,
          actorType: "user",
          action: organizationId ? "content.created_by_organization" : "content.created",
          targetId: id,
          targetType: "content",
          details: { status, type: parsed.data.type, ...(organizationId ? { organizationId } : {}) },
        },
      );
    } catch (error) {
      const pg = error as { code?: string; cause?: { code?: string } };
      if (pg?.code === "23505" || pg?.cause?.code === "23505")
        throw new AppError("Slug already exists", 409, "SLUG_CONFLICT");
      throw error;
    }
  }
  async update(id: string, input: unknown, actor: User, archive = false, organizationId?: string) {
    const parsed = (archive ? writerArchiveSchema : writerUpdateSchema).safeParse(input);
    if (!parsed.success) throw new ValidationError("Invalid publication update");
    return authorContentRepository.mutate(
      id,
      actor.id,
      new Date(parsed.data.expectedUpdatedAt),
      parsed.data.expectedStatus,
      archive ? null : writerUpdateSchema.parse(input),
      {
        id: generateId("aud"),
        actorId: actor.id,
        actorType: "user",
        action: organizationId
          ? archive ? "content.archived_by_organization" : "content.edited_by_organization"
          : archive ? "content.archived_by_author" : "content.edited_by_author",
        targetId: id,
        targetType: "content",
        ...(organizationId ? { details: { organizationId } } : {}),
      },
      ...((organizationId ? [organizationId] : []) as [] | [string]),
    );
  }
}
export const authorContentService = new AuthorContentService();
