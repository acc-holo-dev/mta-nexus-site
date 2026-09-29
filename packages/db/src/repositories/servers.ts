import { and, desc, eq, or, inArray } from "drizzle-orm";
import { db } from "../client";
import { servers } from "../schema";
import type { Server } from "@nexus/domain";

export class ServerRepository {
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

  async listByOwner(ownerId: string): Promise<Server[]> {
    const rows = await db
      .select()
      .from(servers)
      .where(eq(servers.ownerId, ownerId))
      .orderBy(desc(servers.updatedAt));
    return rows as unknown as Server[];
  }

  async findById(id: string): Promise<Server | null> {
    const rows = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
    return (rows[0] as unknown as Server) || null;
  }

  async findPublicBySlug(slug: string): Promise<Server | null> {
    const rows = await db
      .select()
      .from(servers)
      .where(
        and(
          eq(servers.slug, slug),
          eq(servers.status, "active"),
          or(eq(servers.visibility, "public"), eq(servers.visibility, "unlisted"))
        )
      )
      .limit(1);
    return (rows[0] as unknown as Server) || null;
  }

  async listActiveVisibleByIds(ids: string[]): Promise<Server[]> {
    if (ids.length === 0) return [];
    const rows = await db
      .select()
      .from(servers)
      .where(
        and(
          inArray(servers.id, ids.slice(0, 100)),
          eq(servers.status, "active"),
          or(eq(servers.visibility, "public"), eq(servers.visibility, "unlisted"))
        )
      )
      .orderBy(desc(servers.updatedAt))
      .limit(100);
    return rows as unknown as Server[];
  }

  async create(server: Omit<Server, "createdAt" | "updatedAt">): Promise<Server> {
    const values = { ...server, createdAt: new Date(), updatedAt: new Date() };
    const rows = await db.insert(servers).values(values).returning();
    return rows[0] as unknown as Server;
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

}

export const serverRepository = new ServerRepository();
