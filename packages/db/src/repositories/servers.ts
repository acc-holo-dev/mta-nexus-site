import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "../client";
import { servers, serverInstallations } from "../schema";
import type { Server, ServerInstallation } from "@nexus/domain";

export class ServerRepository {
  async listActivePublic(): Promise<Server[]> {
        const rows = await db
      .select()
      .from(servers)
      .where(
        and(
          eq(servers.visibility, "public"),
          eq(servers.status, "active"),
          gte(servers.updatedAt, new Date(Date.now() - 3 * 60 * 1000))
        )
      )
      .orderBy(desc(servers.currentPlayers));
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
    const values = {
      ...server,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

        const rows = await db.insert(servers).values(values).returning();
    return rows[0] as unknown as Server;
  }

  async createInstallation(inst: Omit<ServerInstallation, "createdAt">): Promise<ServerInstallation> {
    const values = {
      ...inst,
      createdAt: new Date(),
    };

        const rows = await db.insert(serverInstallations).values(values).returning();
    return rows[0] as unknown as ServerInstallation;
  }
}

export const serverRepository = new ServerRepository();
