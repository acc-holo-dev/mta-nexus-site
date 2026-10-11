import {
  authorContentRepository,
  contentRepository,
  organizationContentRepository,
  serverContentRepository,
} from "@nexus/db";
import type { User } from "@nexus/domain";
import { AppError, NotFoundError, ValidationError } from "@nexus/domain";
import { generateId } from "@nexus/security";
import { safeExternalWebUrl } from "@nexus/validation";
import {
  type AuthorPublicationDeskQuery,
  authorPublicationRestoreSchema,
  type parseAuthorPublicationHistoryQuery,
} from "../author-publication-desk-contract";
import {
  writerArchiveSchema,
  writerCreateSchema,
  writerUpdateSchema,
} from "../user-platform-contract";

class AuthorContentService {
  async desk(actor: User, filters: AuthorPublicationDeskQuery) {
    const result = await authorContentRepository.desk(actor.id, filters);
    return {
      olderCursor: result.olderCursor,
      newerCursor: result.newerCursor,
      items: result.items.map((item) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        type: item.type as Exclude<AuthorPublicationDeskQuery["type"], "all">,
        status: item.status as "draft" | "published" | "archived",
        excerpt: item.excerpt,
        updatedAt: item.updatedAt,
        commentCount: Math.max(0, item.commentCount),
        source: item.source as "personal" | "organization" | "server",
        recoverable: item.recoverable,
        tags: item.tags,
        organization:
          item.organizationName && item.organizationSlug
            ? {
                name: item.organizationName,
                href: `/organizations/${encodeURIComponent(item.organizationSlug)}`,
              }
            : null,
        server:
          item.serverName && item.serverSlug
            ? { name: item.serverName, href: `/servers/${encodeURIComponent(item.serverSlug)}` }
            : null,
      })),
    };
  }
  async history(
    id: string,
    actor: User,
    filters: NonNullable<ReturnType<typeof parseAuthorPublicationHistoryQuery>>,
    organizationId?: string,
    serverId?: string,
  ) {
    if (organizationId && serverId)
      throw new AppError("Ambiguous publication scope", 400, "VALIDATION_ERROR");
    if (serverId !== undefined && !/^[a-zA-Z0-9_-]{1,128}$/u.test(serverId))
      throw new NotFoundError("Server");
    if (!/^[a-zA-Z0-9_-]{1,128}$/u.test(id)) throw new NotFoundError("Publication");
    if (organizationId !== undefined && !/^[a-zA-Z0-9_-]{1,128}$/u.test(organizationId))
      throw new NotFoundError("Organization");
    const result = await authorContentRepository.history(
      id,
      actor.id,
      filters.cursor,
      ...((serverId ? [undefined, serverId] : organizationId ? [organizationId] : []) as
        | []
        | [string]
        | [undefined, string]),
    );
    return {
      ...(organizationId ? { organization: result.organization } : {}),
      ...(serverId ? { server: result.server } : {}),
      item: {
        id: result.item.id,
        title: result.item.title,
        status: result.item.status,
        revision: result.item.revision,
        recoverable: result.item.recoverable,
      },
      olderCursor: result.olderCursor,
      events: result.events.map((event) => ({
        ...(organizationId || serverId
          ? {
              identity:
                !["content.published", "content.archived"].includes(event.action) &&
                event.actorUsername &&
                event.actorName
                  ? { username: event.actorUsername, name: event.actorName }
                  : null,
            }
          : {}),
        id: event.id,
        createdAt: event.createdAt,
        from: event.from,
        to: event.to,
        kind: event.action.startsWith("content.created")
          ? "created"
          : event.action.startsWith("content.edited")
            ? "edited"
            : event.action.startsWith("content.restored_by_")
              ? "restored"
              : event.action === "content.published"
                ? "published"
                : "archived",
        actor: ["content.published", "content.archived"].includes(event.action)
          ? "moderation"
          : event.action.endsWith("_by_server") || event.action.endsWith("_by_organization")
            ? "team"
            : "author",
      })),
    };
  }
  async restore(
    id: string,
    input: unknown,
    actor: User,
    organizationId?: string,
    serverId?: string,
  ) {
    if (organizationId && serverId)
      throw new AppError("Ambiguous publication scope", 400, "VALIDATION_ERROR");
    if (serverId !== undefined && !/^[a-zA-Z0-9_-]{1,128}$/u.test(serverId))
      throw new NotFoundError("Server");
    if (!/^[a-zA-Z0-9_-]{1,128}$/u.test(id)) throw new NotFoundError("Publication");
    if (organizationId !== undefined && !/^[a-zA-Z0-9_-]{1,128}$/u.test(organizationId))
      throw new NotFoundError("Organization");
    const parsed = authorPublicationRestoreSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid archive revision", 400, "VALIDATION_ERROR");
    return authorContentRepository.restore(
      id,
      actor.id,
      parsed.data.expectedRevision,
      {
        id: generateId("aud"),
        actorId: actor.id,
        actorType: "user",
        action: serverId
          ? "content.restored_by_server"
          : organizationId
            ? "content.restored_by_organization"
            : "content.restored_by_author",
        targetId: id,
        targetType: "content",
      },
      ...((serverId ? [undefined, serverId] : organizationId ? [organizationId] : []) as
        | []
        | [string]
        | [undefined, string]),
    );
  }

  async get(id: string, actor: User) {
    const item = await authorContentRepository.findAuthored(id, actor.id);
    if (!item) throw new NotFoundError("Content");
    return {
      ...item,
      coverImageUrl: safeExternalWebUrl(item.coverImageUrl) ? item.coverImageUrl : undefined,
    };
  }
  async create(input: unknown, actor: User, organizationId?: string, serverId?: string) {
    if (organizationId && serverId) throw new ValidationError("Ambiguous publication scope");
    const parsed = writerCreateSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Invalid publication");
    const status =
      parsed.data.type === "post" || parsed.data.type === "question" ? "published" : "draft";
    const id = generateId("cnt");
    try {
      const save = serverId
        ? (
            data: Parameters<typeof contentRepository.createWithAudit>[0],
            audit: Parameters<typeof contentRepository.createWithAudit>[1],
          ) => serverContentRepository.create(serverId, actor.id, data, audit)
        : organizationId
          ? (
              data: Parameters<typeof contentRepository.createWithAudit>[0],
              audit: Parameters<typeof contentRepository.createWithAudit>[1],
            ) => organizationContentRepository.create(organizationId, actor.id, data, audit)
          : contentRepository.createWithAudit.bind(contentRepository);
      return await save(
        {
          ...parsed.data,
          id,
          authorId: actor.id,
          ...(organizationId ? { organizationId } : {}),
          ...(serverId ? { serverId } : {}),
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
          action: serverId
            ? "content.created_by_server"
            : organizationId
              ? "content.created_by_organization"
              : "content.created",
          targetId: id,
          targetType: "content",
          details: {
            status,
            type: parsed.data.type,
            ...(organizationId ? { organizationId } : {}),
            ...(serverId ? { serverId } : {}),
          },
        },
      );
    } catch (error) {
      const pg = error as {
        code?: string;
        constraint?: string;
        cause?: { code?: string; constraint?: string };
      };
      const constraint = pg?.constraint ?? pg?.cause?.constraint;
      if (
        (pg?.code === "23505" || pg?.cause?.code === "23505") &&
        (!constraint || ["content_slug_idx", "content_slug_unique"].includes(constraint))
      )
        throw new AppError("Slug already exists", 409, "SLUG_CONFLICT");
      throw error;
    }
  }
  async update(
    id: string,
    input: unknown,
    actor: User,
    archive = false,
    organizationId?: string,
    serverId?: string,
  ) {
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
        action: serverId
          ? archive
            ? "content.archived_by_server"
            : "content.edited_by_server"
          : organizationId
            ? archive
              ? "content.archived_by_organization"
              : "content.edited_by_organization"
            : archive
              ? "content.archived_by_author"
              : "content.edited_by_author",
        targetId: id,
        targetType: "content",
        ...(organizationId || serverId
          ? {
              details: {
                ...(organizationId ? { organizationId } : {}),
                ...(serverId ? { serverId } : {}),
              },
            }
          : {}),
      },
      ...((serverId ? [undefined, serverId] : organizationId ? [organizationId] : []) as
        | []
        | [string]
        | [undefined, string]),
    );
  }
}
export const authorContentService = new AuthorContentService();
