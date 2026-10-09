import { and, asc, count, desc, eq, gt, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { containsPattern } from "./search-pattern";
import { db } from "../client";
import { auditEvents, servers } from "../schema";
import type { AuditEvent, Server } from "@nexus/domain";

type ServerEditableFields = Partial<
  Pick<Server, "name" | "description" | "websiteUrl" | "discordUrl" |
    "rulesUrl" | "mediaUrls" | "language" | "region" | "gameplayTags" |
    "ipAddress" | "port" | "httpPort" | "gameMode" | "mapName" |
    "maxPlayers" | "visibility">
>;

/**
 * PostgreSQL evaluates SQL SET expressions against the original row.
 * Clear telemetry only if the stored endpoint actually changes, without
 * read-before-write races or additional SELECTs.
 */
function resetLiveStateForEndpointEdit(updates: ServerEditableFields) {
  const changes = [];
  if (updates.ipAddress !== undefined) {
    changes.push(sql`${servers.ipAddress} IS DISTINCT FROM ${updates.ipAddress}`);
  }
  if (updates.port !== undefined) {
    changes.push(sql`${servers.port} IS DISTINCT FROM ${updates.port}`);
  }
  if (changes.length === 0) return {};
  const changed = sql.join(changes, sql` OR `);
  return {
    currentPlayers: sql<number | null>`CASE WHEN (${changed}) THEN NULL ELSE ${servers.currentPlayers} END`,
    lastObservedAt: sql<Date | null>`CASE WHEN (${changed}) THEN NULL ELSE ${servers.lastObservedAt} END`,
    observationSource: sql<string | null>`CASE WHEN (${changed}) THEN NULL ELSE ${servers.observationSource} END`,
    isVerified: sql<boolean>`CASE WHEN (${changed}) THEN false ELSE ${servers.isVerified} END`,
    endpointRevision: sql<number>`CASE WHEN (${changed}) THEN ${servers.endpointRevision} + 1 ELSE ${servers.endpointRevision} END`,
    ...(updates.maxPlayers === undefined
      ? { maxPlayers: sql<number | null>`CASE WHEN (${changed}) THEN NULL ELSE ${servers.maxPlayers} END` }
      : {}),
  };
}

export class ServerRepository {
  async pageActivePublicByOwner(ownerId: string, requestedPage = 1, requestedSize = 12) {
    const pageSize = Number.isFinite(requestedSize)
      ? Math.min(Math.max(Math.floor(requestedSize), 1), 100) : 12;
    const requested = Number.isFinite(requestedPage)
      ? Math.min(Math.max(Math.floor(requestedPage), 1), Number.MAX_SAFE_INTEGER) : 1;
    const condition = and(
      eq(servers.ownerId, ownerId),
      eq(servers.visibility, "public"),
      eq(servers.status, "active"),
    );
    const [summary] = await db.select({ total: count() }).from(servers).where(condition);
    const total = summary?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requested, totalPages);
    const rows = await db.select().from(servers).where(condition)
      .orderBy(desc(servers.updatedAt), desc(servers.id))
      .limit(pageSize).offset((page - 1) * pageSize);
    return { servers: rows as unknown as Server[], total, page, pageSize, totalPages };
  }


  async countActivePublic(): Promise<number> {
    const [row] = await db.select({ total: count() }).from(servers).where(and(
      eq(servers.visibility, "public"),
      eq(servers.status, "active"),
    ));
    return row?.total ?? 0;
  }

  async searchActivePublic(term: string, limit = 50): Promise<Server[]> {
    const pattern = containsPattern(term);
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 50)
      : 50;
    const rows = await db.select().from(servers).where(and(
      eq(servers.visibility, "public"),
      eq(servers.status, "active"),
      or(ilike(servers.name, pattern), ilike(servers.description, pattern), ilike(servers.gameMode, pattern)),
    )).orderBy(desc(servers.updatedAt), desc(servers.id)).limit(boundedLimit);
    return rows as unknown as Server[];
  }

  async listActivePublic(limit?: number): Promise<Server[]> {
    const query = db
      .select()
      .from(servers)
      .where(
        and(
          eq(servers.visibility, "public"),
          eq(servers.status, "active")
        )
      )
      .orderBy(desc(servers.updatedAt), desc(servers.id));
    const boundedLimit =
      limit === undefined
        ? undefined
        : Number.isFinite(limit)
          ? Math.min(Math.max(Math.floor(limit), 1), 100)
          : 100;
    const rows = boundedLimit === undefined ? await query : await query.limit(boundedLimit);
    return rows as unknown as Server[];
  }

  async listObservable(limit = 501): Promise<Pick<Server, "id" | "ipAddress" | "port">[]> {
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 501)
      : 501;
    // Observation matching needs only endpoints and stable IDs, not the
    // potentially large editorial descriptions, images or JSON metadata.
    const rows = await db
      .select({
        id: servers.id,
        ipAddress: servers.ipAddress,
        port: servers.port,
      })
      .from(servers)
      .where(
        and(
          eq(servers.status, "active"),
          ne(servers.visibility, "private"),
        ),
      )
      // Stable tie-breaking avoids arbitrarily shifting the 501-row
      // sentinel when many listings share the same updated timestamp.
      .orderBy(desc(servers.updatedAt), desc(servers.id))
      .limit(boundedLimit);
    return rows;
  }

  /**
   * Keyset pagination for large observation captures. Unlike a permanent
   * "newest 500" cap, a cursor can cover every eligible server in bounded
   * pages. The id ordering is stable when profile timestamps change.
   */
  async listObservableAfter(
    limit = 501,
    afterId?: string,
  ): Promise<Pick<Server, "id" | "ipAddress" | "port">[]> {
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 501)
      : 501;
    const rows = await db.select({
      id: servers.id,
      ipAddress: servers.ipAddress,
      port: servers.port,
    }).from(servers).where(and(
      eq(servers.status, "active"),
      ne(servers.visibility, "private"),
      afterId ? gt(servers.id, afterId) : undefined,
    )).orderBy(asc(servers.id)).limit(boundedLimit);
    return rows;
  }

  async listByOwner(ownerId: string): Promise<Server[]> {
    const rows = await db
      .select()
      .from(servers)
      .where(eq(servers.ownerId, ownerId))
      .orderBy(desc(servers.updatedAt), desc(servers.id));
    return rows as unknown as Server[];
  }

  async listActivePublicByOwner(ownerId: string): Promise<Server[]> {
    const rows = await db.select().from(servers).where(and(
      eq(servers.ownerId, ownerId),
      eq(servers.visibility, "public"),
      eq(servers.status, "active"),
    )).orderBy(desc(servers.updatedAt), desc(servers.id));
    return rows as unknown as Server[];
  }

  async listActivePublicByIds(ids: readonly string[]): Promise<Server[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return [];
    const result: Server[] = [];
    for (let offset = 0; offset < uniqueIds.length; offset += 500) {
      const rows = await db.select().from(servers).where(and(
        inArray(servers.id, uniqueIds.slice(offset, offset + 500)),
        eq(servers.visibility, "public"),
        eq(servers.status, "active"),
      ));
      result.push(...rows as unknown as Server[]);
    }
    return result;
  }

  async findById(id: string): Promise<Server | null> {
    const rows = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
    return (rows[0] as unknown as Server) || null;
  }

  async findBySlug(slug: string): Promise<Server | null> {
    const rows = await db.select().from(servers).where(eq(servers.slug, slug)).limit(1);
    return (rows[0] as unknown as Server) || null;
  }

  async create(server: Omit<Server, "createdAt" | "updatedAt">): Promise<Server> {
    const values = { ...server, createdAt: new Date(), updatedAt: new Date() };
    const rows = await db.insert(servers).values(values).returning();
    return rows[0] as unknown as Server;
  }

  async createWithAudit(
    server: Omit<Server, "createdAt" | "updatedAt">,
    audit: Omit<AuditEvent, "createdAt">,
  ): Promise<Server> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const rows = await tx
        .insert(servers)
        .values({ ...server, createdAt: now, updatedAt: now })
        .returning();
      const created = rows[0];
      if (!created) throw new Error("Server insert did not return a row");

      await tx.insert(auditEvents).values({ ...audit, createdAt: now });
      return created as unknown as Server;
    });
  }

  async update(
    id: string,
    updates: ServerEditableFields
  ): Promise<Server | null> {
    const rows = await db
      .update(servers)
      .set({ ...updates, ...resetLiveStateForEndpointEdit(updates), updatedAt: new Date() })
      .where(eq(servers.id, id))
      .returning();
    return (rows[0] as unknown as Server) || null;
  }

  async updateWithAudit(
    id: string,
    updates: ServerEditableFields,
    audit: Omit<AuditEvent, "createdAt">,
  ): Promise<Server | null> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const rows = await tx
        .update(servers)
        .set({ ...updates, ...resetLiveStateForEndpointEdit(updates), updatedAt: now })
        .where(eq(servers.id, id))
        .returning();
      const updated = rows[0];
      if (!updated) return null;

      await tx.insert(auditEvents).values({ ...audit, createdAt: now });
      return updated as unknown as Server;
    });
  }

}

export const serverRepository = new ServerRepository();
