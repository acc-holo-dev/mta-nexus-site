import { and, desc, eq, inArray, or, ilike, sql, getTableColumns } from "drizzle-orm";
import { AppError, canManageOrganization, NotFoundError } from "@nexus/domain";
import type { AuditEvent, Content } from "@nexus/domain";
import { db } from "../client";
import { auditEvents, content, organizations, organizationMembers } from "../schema";
import { containsPattern } from "./search-pattern";
import { organizationWorkspaceAccess } from "./organization-workspace";

export type ContentSummary = Pick<
  Content,
  "id" | "slug" | "title" | "excerpt" | "type" | "status" | "commentCount" | "updatedAt"
>;
export type ContentPageFilters = {
  page?: number;
  query?: string;
  type?: Content["type"];
  status?: Content["status"];
};
type ContentEditFields = Pick<Content, "title" | "body" | "tags"> &
  Pick<Content, "excerpt" | "coverImageUrl">;
export const contentSummaryColumns = {
  id: content.id,
  slug: content.slug,
  title: content.title,
  excerpt: content.excerpt,
  type: content.type,
  status: content.status,
  commentCount: content.commentCount,
  updatedAt: content.updatedAt,
};

class AuthorContentRepository {
  async pageByAuthor(authorId: string, filters: ContentPageFilters = {}) {
    const page = Number.isSafeInteger(filters.page)
      ? Math.min(Math.max(filters.page ?? 1, 1), 9999)
      : 1;
    const pattern = filters.query?.trim()
      ? containsPattern(filters.query.trim().slice(0, 120))
      : undefined;
    const rows = await db
      .select(contentSummaryColumns)
      .from(content)
      .where(
        and(
          eq(content.authorId, authorId),
          filters.status ? eq(content.status, filters.status) : undefined,
          filters.type ? eq(content.type, filters.type) : undefined,
          pattern ? or(ilike(content.title, pattern), ilike(content.slug, pattern)) : undefined,
        ),
      )
      .orderBy(desc(content.updatedAt), desc(content.id))
      .limit(21)
      .offset((page - 1) * 20);
    return {
      items: rows.slice(0, 20) as unknown as ContentSummary[],
      page,
      hasMore: rows.length > 20 && page < 9999,
    };
  }

  async findAuthored(id: string, authorId: string): Promise<Content | null> {
    const [row] = await db
      .select()
      .from(content)
      .where(and(eq(content.id, id), eq(content.authorId, authorId)))
      .limit(1);
    return (row as unknown as Content) ?? null;
  }

  async mutate(
    id: string,
    authorId: string,
    expectedUpdatedAt: Date,
    expectedStatus: Content["status"],
    fields: ContentEditFields | null,
    audit: Omit<AuditEvent, "createdAt">,
    organizationId?: string,
  ): Promise<Content> {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(content)
        .where(and(eq(content.id, id), organizationId
          ? eq(content.organizationId, organizationId)
          : eq(content.authorId, authorId)))
        .for("update")
        .limit(1);
      if (!current) throw new NotFoundError("Content");
      // Organization editors share the same content-first lock order and mutation
      // rules as authors. A platform role never substitutes for current team rights.
      if (organizationId) {
        const access = await organizationWorkspaceAccess(tx, organizationId, authorId, true);
        if (!canManageOrganization(access.role))
          throw new AppError("Organization editor required", 403, "FORBIDDEN");
      }
      if (current.status === "archived")
        throw new AppError("Content is archived", 409, "CONTENT_ARCHIVED");
      if (
        current.updatedAt.getTime() !== expectedUpdatedAt.getTime() ||
        current.status !== expectedStatus
      ) {
        throw new AppError("Content changed", 409, "CONFLICT");
      }
      if (current.organizationId && !organizationId) {
        const [org] = await tx
          .select({ ownerId: organizations.ownerId })
          .from(organizations)
          .where(eq(organizations.id, current.organizationId))
          .for("share")
          .limit(1);
        if (!org) throw new AppError("Organization is unavailable", 403, "FORBIDDEN");
        if (org.ownerId !== authorId) {
          const [member] = await tx
            .select({ role: organizationMembers.role })
            .from(organizationMembers)
            .where(
              and(
                eq(organizationMembers.organizationId, current.organizationId),
                eq(organizationMembers.userId, authorId),
              ),
            )
            .for("share")
            .limit(1);
          if (!member || !["admin", "developer"].includes(member.role)) {
            throw new AppError("Organization permission revoked", 403, "FORBIDDEN");
          }
        }
      }
      const status =
        fields === null
          ? "archived"
          : current.type === "post" || current.type === "question"
            ? "published"
            : "draft";
      const [updated] = await tx
        .update(content)
        .set({
          ...(fields
            ? {
                title: fields.title,
                body: fields.body,
                tags: fields.tags,
                excerpt: fields.excerpt || null,
                coverImageUrl: fields.coverImageUrl || null,
              }
            : {}),
          status,
          publishedAt: status === "published" ? (current.publishedAt ?? new Date()) : null,
          // Versions must advance even for two operations within the same millisecond.
          updatedAt: sql`greatest(clock_timestamp(), date_trunc('milliseconds', ${content.updatedAt}) + interval '1 millisecond')`,
        })
        .where(eq(content.id, id))
        .returning();
      await tx
        .insert(auditEvents)
        .values({ ...audit, details: { ...audit.details, from: current.status, to: status }, createdAt: new Date() });
      return updated as unknown as Content;
    });
  }

  async pagePublic(types: Content["type"][], filters: ContentPageFilters = {}) {
    const page = Number.isSafeInteger(filters.page)
      ? Math.min(Math.max(filters.page ?? 1, 1), 9999)
      : 1;
    const selectedTypes = filters.type ? types.filter((value) => value === filters.type) : types;
    if (!selectedTypes.length) return { items: [] as Content[], page, hasMore: false };
    const pattern = filters.query?.trim()
      ? containsPattern(filters.query.trim().slice(0, 120))
      : undefined;
    const rows = await db
      .select({ ...getTableColumns(content), body: sql<string>`left(${content.body}, 350)` })
      .from(content)
      .where(
        and(
          eq(content.status, "published"),
          inArray(content.type, selectedTypes),
          pattern
            ? or(
                ilike(content.title, pattern),
                ilike(content.excerpt, pattern),
                ilike(content.body, pattern),
                sql`exists (select 1 from jsonb_array_elements_text(${content.tags}) as tag(value) where tag.value ilike ${pattern})`,
              )
            : undefined,
        ),
      )
      .orderBy(desc(sql`coalesce(${content.publishedAt}, ${content.createdAt})`), desc(content.id))
      .limit(25)
      .offset((page - 1) * 24);
    return {
      items: rows.slice(0, 24) as unknown as Content[],
      page,
      hasMore: rows.length > 24 && page < 9999,
    };
  }
}
export const authorContentRepository = new AuthorContentRepository();
