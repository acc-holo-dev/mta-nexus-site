import type { AuditEvent, Content } from "@nexus/domain";
import { AppError, canManageOrganization, NotFoundError, UnauthorizedError } from "@nexus/domain";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, content, users } from "../schema";
import { type ContentPageFilters, contentSummaryColumns } from "./content-summary";
import { lockInitiatingSession } from "./initiating-session";
import { organizationWorkspaceAccess } from "./organization-workspace";
import { publicationNotice } from "./publication-notice";
import { containsPattern } from "./search-pattern";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function access(tx: Transaction, organizationId: string, actorId: string, lock = false) {
  const result = await organizationWorkspaceAccess(tx, organizationId, actorId, lock);
  if (!canManageOrganization(result.role))
    throw new AppError("Organization editor required", 403, "FORBIDDEN");
  return {
    id: result.organization.id,
    slug: result.organization.slug,
    name: result.organization.name,
  };
}
class OrganizationContentRepository {
  context(organizationId: string, actorId: string) {
    return db.transaction((tx) => access(tx, organizationId, actorId), {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
  }
  async page(organizationId: string, actorId: string, filters: ContentPageFilters = {}) {
    return db.transaction(
      async (tx) => {
        const organization = await access(tx, organizationId, actorId);
        const page = Number.isSafeInteger(filters.page)
          ? Math.min(Math.max(filters.page ?? 1, 1), 9999)
          : 1;
        const pattern = filters.query?.trim()
          ? containsPattern(filters.query.trim().slice(0, 120))
          : undefined;
        const rows = await tx
          .select({
            ...contentSummaryColumns,
            authorId: content.authorId,
            authorUsername: users.username,
            authorName: users.displayName,
          })
          .from(content)
          .leftJoin(users, eq(users.id, content.authorId))
          .where(
            and(
              eq(content.organizationId, organizationId),
              filters.status ? eq(content.status, filters.status) : undefined,
              filters.type ? eq(content.type, filters.type) : undefined,
              pattern ? or(ilike(content.title, pattern), ilike(content.slug, pattern)) : undefined,
            ),
          )
          .orderBy(desc(content.updatedAt), desc(content.id))
          .limit(21)
          .offset((page - 1) * 20);
        return {
          organization,
          items: rows.slice(0, 20),
          page,
          hasMore: rows.length > 20 && page < 9999,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async get(organizationId: string, actorId: string, id: string) {
    return db.transaction(
      async (tx) => {
        const organization = await access(tx, organizationId, actorId);
        const [row] = await tx
          .select()
          .from(content)
          .where(and(eq(content.id, id), eq(content.organizationId, organizationId)))
          .limit(1);
        if (!row) throw new NotFoundError("Content");
        return { organization, content: row };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async create(
    organizationId: string,
    actorId: string,
    data: Omit<Content, "createdAt" | "updatedAt">,
    audit: Omit<AuditEvent, "createdAt">,
    currentToken: string,
  ) {
    return db.transaction(async (tx) => {
      await access(tx, organizationId, actorId, true);
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, actorId))
        .for("share");
      if (!actor) throw new UnauthorizedError("Authentication required");
      await lockInitiatingSession(tx, actorId, currentToken);
      const now = new Date();
      const [created] = await tx
        .insert(content)
        .values({
          ...data,
          organizationId,
          authorId: actorId,
          serverId: null,
          productId: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!created) throw new Error("Content insert did not return a row");
      await tx.insert(auditEvents).values({ ...audit, createdAt: now });
      await publicationNotice(tx, created as unknown as Content, actorId, "created", audit.id);
      await lockInitiatingSession(tx, actorId, currentToken);
      return created as unknown as Content;
    });
  }
}
export const organizationContentRepository = new OrganizationContentRepository();
