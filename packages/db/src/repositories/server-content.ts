import type { AuditEvent, Content } from "@nexus/domain";
import { NotFoundError } from "@nexus/domain";
import { and, desc, eq, exists, ilike, or } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, content, servers, users } from "../schema";
import { type ContentPageFilters, contentSummaryColumns } from "./content-summary";
import { publicationNotice } from "./publication-notice";
import { containsPattern } from "./search-pattern";
import { lockServerManagementGrants, managedServerScope } from "./server-management-scope";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const identity = { id: servers.id, name: servers.name, slug: servers.slug };
/** Called after locking publication; locks current listing and grants until commit. */
export async function serverContentAccess(tx: Transaction, serverId: string, actorId: string) {
  const [server] = await tx
    .select({ ...identity, ownerId: servers.ownerId, organizationId: servers.organizationId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .for("share")
    .limit(1);
  if (!server) throw new NotFoundError("Server");
  await lockServerManagementGrants(tx, [server], actorId);
  return server;
}
export async function serverContentContext(tx: Transaction, serverId: string, actorId: string) {
  const [server] = await tx
    .select(identity)
    .from(servers)
    .where(
      and(
        eq(servers.id, serverId),
        or(
          managedServerScope(actorId),
          exists(
            tx
              .select({ id: users.id })
              .from(users)
              .where(and(eq(users.id, actorId), eq(users.role, "admin"))),
          ),
        ),
      ),
    )
    .limit(1);
  if (!server) throw new NotFoundError("Server");
  return server;
}
const snapshot = { isolationLevel: "repeatable read", accessMode: "read only" } as const;
class ServerContentRepository {
  context(serverId: string, actorId: string) {
    return db.transaction((tx) => serverContentContext(tx, serverId, actorId), snapshot);
  }
  page(serverId: string, actorId: string, filters: ContentPageFilters = {}) {
    return db.transaction(async (tx) => {
      const server = await serverContentContext(tx, serverId, actorId);
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
            eq(content.serverId, serverId),
            filters.status ? eq(content.status, filters.status) : undefined,
            filters.type ? eq(content.type, filters.type) : undefined,
            pattern ? or(ilike(content.title, pattern), ilike(content.slug, pattern)) : undefined,
          ),
        )
        .orderBy(desc(content.updatedAt), desc(content.id))
        .limit(21)
        .offset((page - 1) * 20);
      return { server, items: rows.slice(0, 20), page, hasMore: rows.length > 20 && page < 9999 };
    }, snapshot);
  }
  get(serverId: string, actorId: string, id: string) {
    return db.transaction(async (tx) => {
      const server = await serverContentContext(tx, serverId, actorId);
      const [row] = await tx
        .select()
        .from(content)
        .where(and(eq(content.id, id), eq(content.serverId, serverId)))
        .limit(1);
      if (!row) throw new NotFoundError("Content");
      return { server, content: row };
    }, snapshot);
  }
  create(
    serverId: string,
    actorId: string,
    data: Omit<Content, "createdAt" | "updatedAt">,
    audit: Omit<AuditEvent, "createdAt">,
  ) {
    return db.transaction(async (tx) => {
      const server = await serverContentAccess(tx, serverId, actorId),
        now = new Date();
      const [row] = await tx
        .insert(content)
        .values({
          ...data,
          authorId: actorId,
          serverId,
          organizationId: server.organizationId,
          productId: null,
          status: "draft",
          publishedAt: null,
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) throw new Error("Content insert did not return a row");
      await tx.insert(auditEvents).values({ ...audit, createdAt: now });
      await publicationNotice(tx, row as unknown as Content, actorId, "created", audit.id);
      return row as unknown as Content;
    });
  }
}
export const serverContentRepository = new ServerContentRepository();
