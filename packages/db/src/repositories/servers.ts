import { and, count, desc, eq, ilike, inArray, ne, or } from "drizzle-orm";
import { containsPattern } from "./search-pattern";
import { db } from "../client";
import { auditEvents, servers } from "../schema";
import type { AuditEvent, Server } from "@nexus/domain";

export class ServerRepository {
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
      .orderBy(desc(servers.updatedAt));
    const boundedLimit =
      limit === undefined
        ? undefined
        : Number.isFinite(limit)
          ? Math.min(Math.max(Math.floor(limit), 1), 100)
          : 100;
    const rows = boundedLimit === undefined ? await query : await query.limit(boundedLimit);
    return rows as unknown as Server[];
  }

  async listObservable(limit = 501): Promise<Server[]> {
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 501)
      : 501;
    const rows = await db
      .select()
      .from(servers)
      .where(
        and(
          eq(servers.status, "active"),
          ne(servers.visibility, "private"),
        ),
      )
      .orderBy(desc(servers.updatedAt))
      .limit(boundedLimit);
    return rows as unknown as Server[];
  }

  async listByOwner(ownerId: string): Promise<Server[]> {
    const rows = await db
      .select()
      .from(servers)
      .where(eq(servers.ownerId, ownerId))
      .orderBy(desc(servers.updatedAt));
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
    updates: Partial<Pick<Server, "name" | "description" | "websiteUrl" | "discordUrl" | "rulesUrl" | "mediaUrls" | "language" | "region" | "gameplayTags" | "ipAddress" | "port" | "httpPort" | "gameMode" | "mapName" | "maxPlayers" | "visibility">>
  ): Promise<Server | null> {
    const rows = await db
      .update(servers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(servers.id, id))
      .returning();
    return (rows[0] as unknown as Server) || null;
  }

  async updateWithAudit(
    id: string,
    updates: Partial<Pick<Server, "name" | "description" | "websiteUrl" | "discordUrl" | "rulesUrl" | "mediaUrls" | "language" | "region" | "gameplayTags" | "ipAddress" | "port" | "httpPort" | "gameMode" | "mapName" | "maxPlayers" | "visibility">>,
    audit: Omit<AuditEvent, "createdAt">,
  ): Promise<Server | null> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const rows = await tx
        .update(servers)
        .set({ ...updates, updatedAt: now })
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
