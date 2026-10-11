import { createHash } from "node:crypto";
import type { AuditEvent, Content } from "@nexus/domain";
import { AppError, canManageOrganization, NotFoundError } from "@nexus/domain";
import { and, asc, desc, eq, getTableColumns, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, content, organizationMembers, organizations, servers } from "../schema";
import { contentHelpfulCount } from "./content-reaction-count";
import {
  type ContentPageFilters,
  type ContentSummary,
  contentSummaryColumns,
} from "./content-summary";
import { organizationWorkspaceAccess } from "./organization-workspace";
import { publicationNotice } from "./publication-notice";
import { containsPattern } from "./search-pattern";
import { serverContentAccess } from "./server-content";

type ContentEditFields = Pick<Content, "title" | "body" | "tags"> &
  Pick<Content, "excerpt" | "coverImageUrl">;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DeskCursor = { createdAt: string; id: string; context: string; direction: "older" | "newer" };
const deskTypes = ["article", "news", "devlog", "update", "announcement", "post", "question"];
const historyActions = [
  "content.created",
  "content.created_by_organization",
  "content.created_by_server",
  "content.edited_by_author",
  "content.edited_by_organization",
  "content.edited_by_server",
  "content.archived_by_author",
  "content.archived_by_organization",
  "content.archived_by_server",
  "content.published",
  "content.archived",
  "content.restored_by_author",
];
const exactRevision = sql<string>`to_char(${content.updatedAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
const hash = (parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");
const source = sql<string>`case when ${content.serverId} is not null then 'server' when ${content.organizationId} is not null then 'organization' else 'personal' end`;
function recoverable(actorId: string) {
  return sql<boolean>`${content.status} = 'archived' and exists (select 1 from ${auditEvents} where ${auditEvents.targetType} = 'content' and ${auditEvents.targetId} = ${content.id} and ${auditEvents.actorId} = ${actorId} and ${auditEvents.actorType} = 'user' and ${auditEvents.action} = 'content.archived_by_author' and ${auditEvents.details}->>'to' = 'archived' and ${auditEvents.details}->>'restoreRevision' = ${exactRevision} and not exists (select 1 from audit_events staff_archive where staff_archive.target_type = 'content' and staff_archive.target_id = ${auditEvents.targetId} and staff_archive.action = 'content.archived' and staff_archive.created_at >= ${auditEvents.createdAt}))`;
}
async function authorOrganizationAccess(tx: Transaction, organizationId: string, authorId: string) {
  const [org] = await tx
    .select({ ownerId: organizations.ownerId })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .for("share")
    .limit(1);
  if (!org) throw new AppError("Organization is unavailable", 403, "FORBIDDEN");
  if (org.ownerId === authorId) return;
  const [member] = await tx
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, authorId),
      ),
    )
    .for("share")
    .limit(1);
  if (!member || !["admin", "developer"].includes(member.role))
    throw new AppError("Organization permission revoked", 403, "FORBIDDEN");
}

class AuthorContentRepository {
  async desk(
    authorId: string,
    filters: {
      query: string;
      tag: string;
      status: string;
      type: string;
      source: string;
      cursor?: DeskCursor;
    },
  ) {
    const context = hash([
      1,
      "author-publication-desk",
      authorId,
      filters.query,
      filters.tag.toLowerCase(),
      filters.status,
      filters.type,
      filters.source,
    ]);
    if (filters.cursor && filters.cursor.context !== context)
      throw new AppError("Desk context changed", 400, "INVALID_CURSOR");
    return db.transaction(
      async (tx) => {
        const pattern = filters.query ? containsPattern(filters.query) : undefined,
          newer = filters.cursor?.direction === "newer";
        const rows = await tx
          .select({
            id: content.id,
            slug: content.slug,
            title: sql<string>`left(${content.title},200)`,
            type: content.type,
            status: content.status,
            excerpt: sql<string>`left(coalesce(nullif(${content.excerpt},''),${content.body}),350)`,
            updatedAt: exactRevision,
            createdAt: content.createdAt,
            commentCount: content.commentCount,
            source,
            organizationName: sql<string | null>`left(${organizations.name},200)`,
            organizationSlug: organizations.slug,
            serverName: sql<string | null>`left(${servers.name},200)`,
            serverSlug: servers.slug,
            recoverable: recoverable(authorId),
            tags: sql<
              string[]
            >`(select coalesce(jsonb_agg(left(tag.value,30)),'[]'::jsonb) from (select value from jsonb_array_elements_text(${content.tags}) limit 10) tag)`,
          })
          .from(content)
          .leftJoin(organizations, eq(organizations.id, content.organizationId))
          .leftJoin(
            servers,
            and(
              eq(servers.id, content.serverId),
              eq(servers.visibility, "public"),
              eq(servers.status, "active"),
            ),
          )
          .where(
            and(
              eq(content.authorId, authorId),
              inArray(content.type, deskTypes),
              inArray(content.status, ["draft", "published", "archived"]),
              filters.status !== "all" ? eq(content.status, filters.status) : undefined,
              filters.type !== "all" ? eq(content.type, filters.type) : undefined,
              filters.source !== "all" ? sql`${source} = ${filters.source}` : undefined,
              filters.tag
                ? sql`exists (select 1 from jsonb_array_elements_text(${content.tags}) as tag(value) where lower(tag.value) = ${filters.tag.toLowerCase()})`
                : undefined,
              pattern
                ? or(
                    ilike(content.title, pattern),
                    ilike(content.slug, pattern),
                    ilike(content.excerpt, pattern),
                    ilike(content.body, pattern),
                    sql`exists (select 1 from jsonb_array_elements_text(${content.tags}) as tag(value) where tag.value ilike ${pattern})`,
                  )
                : undefined,
              filters.cursor
                ? newer
                  ? sql`(${content.updatedAt},${content.id}) > (${filters.cursor.createdAt}::timestamptz,${filters.cursor.id})`
                  : sql`(${content.updatedAt},${content.id}) < (${filters.cursor.createdAt}::timestamptz,${filters.cursor.id})`
                : undefined,
            ),
          )
          .orderBy(
            newer ? asc(content.updatedAt) : desc(content.updatedAt),
            newer ? asc(content.id) : desc(content.id),
          )
          .limit(21);
        const items = rows.slice(0, 20);
        if (newer) items.reverse();
        const point = (
          item: (typeof items)[number] | undefined,
          direction: "older" | "newer",
          enabled: boolean,
        ) =>
          item && enabled
            ? JSON.stringify({
                createdAt: item.updatedAt,
                id: item.id,
                context,
                direction,
                version: 1,
              })
            : null;
        return {
          items,
          olderCursor: point(items.at(-1), "older", newer ? !!filters.cursor : rows.length > 20),
          newerCursor: point(items[0], "newer", newer ? rows.length > 20 : !!filters.cursor),
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async history(id: string, authorId: string, cursor?: DeskCursor) {
    const context = hash([1, "author-publication-history", authorId, id]);
    if (cursor && cursor.context !== context)
      throw new AppError("History context changed", 400, "INVALID_CURSOR");
    return db.transaction(
      async (tx) => {
        const [item] = await tx
          .select({
            id: content.id,
            title: sql<string>`left(${content.title},200)`,
            status: content.status,
            revision: exactRevision,
            recoverable: recoverable(authorId),
          })
          .from(content)
          .where(
            and(
              eq(content.id, id),
              eq(content.authorId, authorId),
              inArray(content.type, deskTypes),
            ),
          )
          .limit(1);
        if (!item) throw new NotFoundError("Publication");
        const rows = await tx
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            createdAt: sql<string>`to_char(${auditEvents.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
            from: sql<
              string | null
            >`case when ${auditEvents.details}->>'from' in ('draft','published','archived') then ${auditEvents.details}->>'from' else null end`,
            to: sql<
              string | null
            >`case when coalesce(${auditEvents.details}->>'to',${auditEvents.details}->>'status') in ('draft','published','archived') then coalesce(${auditEvents.details}->>'to',${auditEvents.details}->>'status') else null end`,
          })
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.targetType, "content"),
              eq(auditEvents.targetId, id),
              inArray(auditEvents.action, historyActions),
              cursor
                ? sql`(${auditEvents.createdAt},${auditEvents.id}) < (${cursor.createdAt}::timestamptz,${cursor.id})`
                : undefined,
            ),
          )
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(21);
        const events = rows.slice(0, 20),
          last = events.at(-1);
        return {
          item,
          events,
          olderCursor:
            rows.length > 20 && last
              ? JSON.stringify({
                  createdAt: last.createdAt,
                  id: last.id,
                  context,
                  direction: "older",
                  version: 1,
                })
              : null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async restore(
    id: string,
    authorId: string,
    expectedRevision: string,
    audit: Omit<AuditEvent, "createdAt">,
  ) {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select({ ...getTableColumns(content), revision: exactRevision })
        .from(content)
        .where(
          and(eq(content.id, id), eq(content.authorId, authorId), inArray(content.type, deskTypes)),
        )
        .for("update")
        .limit(1);
      if (!current) throw new NotFoundError("Publication");
      if (current.status !== "archived" || current.revision !== expectedRevision)
        throw new AppError("Publication changed", 409, "CONFLICT");
      const [proof] = await tx
        .select({ id: content.id })
        .from(content)
        .where(and(eq(content.id, id), recoverable(authorId)))
        .limit(1);
      if (!proof)
        throw new AppError(
          "Archive has no current author proof",
          403,
          "PUBLICATION_RESTORE_DENIED",
        );
      if (current.serverId) await serverContentAccess(tx, current.serverId, authorId);
      if (current.organizationId)
        await authorOrganizationAccess(tx, current.organizationId, authorId);
      const [updated] = await tx
        .update(content)
        .set({
          status: "draft",
          publishedAt: null,
          updatedAt: sql`greatest(clock_timestamp(),date_trunc('milliseconds',${content.updatedAt}) + interval '1 millisecond')`,
        })
        .where(eq(content.id, id))
        .returning({ ...getTableColumns(content), revision: exactRevision });
      if (!updated) throw new AppError("Publication changed", 409, "CONFLICT");
      await tx.insert(auditEvents).values({
        ...audit,
        actorId: authorId,
        actorType: "user",
        action: "content.restored_by_author",
        targetId: id,
        targetType: "content",
        details: { from: "archived", to: "draft" },
        createdAt: new Date(),
      });
      await publicationNotice(tx, updated as unknown as Content, authorId, "restored", audit.id);
      return { id: updated.id, status: "draft" as const, revision: updated.revision };
    });
  }

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
    serverId?: string,
  ): Promise<Content> {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(content)
        .where(
          and(
            eq(content.id, id),
            serverId
              ? eq(content.serverId, serverId)
              : organizationId
                ? eq(content.organizationId, organizationId)
                : eq(content.authorId, authorId),
          ),
        )
        .for("update")
        .limit(1);
      if (!current) throw new NotFoundError("Content");
      // Organization editors share the same content-first lock order and mutation
      // rules as authors. A platform role never substitutes for current team rights.
      if (serverId && organizationId)
        throw new AppError("Ambiguous publication scope", 400, "VALIDATION_FAILED");
      if (current.serverId) await serverContentAccess(tx, current.serverId, authorId);
      if (organizationId) {
        const access = await organizationWorkspaceAccess(tx, organizationId, authorId, "share");
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
      if (current.organizationId && !organizationId && !serverId)
        await authorOrganizationAccess(tx, current.organizationId, authorId);
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
        .returning({ ...getTableColumns(content), archiveRevision: exactRevision });
      if (!updated) throw new AppError("Content changed", 409, "CONFLICT");
      await tx.insert(auditEvents).values({
        ...audit,
        details: {
          ...audit.details,
          from: current.status,
          to: status,
          ...(fields === null &&
          deskTypes.includes(current.type) &&
          audit.action === "content.archived_by_author"
            ? { restoreRevision: updated.archiveRevision }
            : {}),
        },
        createdAt: new Date(),
      });
      await publicationNotice(
        tx,
        updated as unknown as Content,
        authorId,
        fields ? "edited" : "archived",
        audit.id,
      );
      const { archiveRevision: _archiveRevision, ...saved } = updated;
      return saved as unknown as Content;
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
      .select({
        ...getTableColumns(content),
        body: sql<string>`left(${content.body}, 350)`,
        likeCount: contentHelpfulCount(),
      })
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
