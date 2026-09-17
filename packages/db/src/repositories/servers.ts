import { and, desc, eq } from "drizzle-orm";
import { db } from "../client";
import { servers } from "../schema";
import type { Server } from "@nexus/domain";

export class ServerRepository {
  async listActivePublic(): Promise<Server[]> {
    const rows = await db
      .select()
      .from(servers)
      .where(
        and(
          eq(servers.visibility, "public"),
          eq(servers.status, "active")
        )
      )
      .orderBy(desc(servers.updatedAt));
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

  async findBySlug(slug: string): Promise<Server | null> {
    const rows = await db.select().from(servers).where(eq(servers.slug, slug)).limit(1);
    return (rows[0] as unknown as Server) || null;
  }

  async create(server: Omit<Server, "createdAt" | "updatedAt">): Promise<Server> {
    const values = { ...server, createdAt: new Date(), updatedAt: new Date() };
    const rows = await db.insert(servers).values(values).returning();
    return rows[0] as unknown as Server;
  }

  async update(
    id: string,
    updates: Partial<Pick<Server, "name" | "description" | "ipAddress" | "port" | "httpPort" | "gameMode" | "mapName" | "maxPlayers" | "visibility">>
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
