import { and, desc, eq, ilike, or } from "drizzle-orm";
import { AppError, canManageOrganization, NotFoundError } from "@nexus/domain";
import type { AuditEvent, Content } from "@nexus/domain";
import { db } from "../client";
import { auditEvents, content, users } from "../schema";
import { organizationWorkspaceAccess } from "./organization-workspace";
import { contentSummaryColumns, type ContentPageFilters } from "./author-content";
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
  ) {
    return db.transaction(async (tx) => {
      await access(tx, organizationId, actorId, true);
      const now = new Date();
      const [created] = await tx
        .insert(content)
        .values({ ...data, organizationId, authorId: actorId, createdAt: now, updatedAt: now })
        .returning();
      if (!created) throw new Error("Content insert did not return a row");
      await tx.insert(auditEvents).values({ ...audit, createdAt: now });
      return created as unknown as Content;
    });
  }
}
export const organizationContentRepository = new OrganizationContentRepository();
