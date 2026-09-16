import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../client";
import { serverHeartbeats, serverInstallations, servers } from "../schema";
import { generateId } from "@nexus/security";

export interface HeartbeatInput {
  installationId: string;
  serverId: string;
  status: "online" | "offline" | "maintenance";
  currentPlayers: number;
  maxPlayers: number;
  moduleVersion?: string;
  mtaVersion?: string;
}

export class TelemetryRepository {
  async recordHeartbeat(input: HeartbeatInput) {
    const recordedAt = new Date();
    const values = {
      id: generateId("ins"),
      installationId: input.installationId,
      serverId: input.serverId,
      status: input.status,
      currentPlayers: input.currentPlayers,
      maxPlayers: input.maxPlayers,
      moduleVersion: input.moduleVersion,
      mtaVersion: input.mtaVersion,
      recordedAt,
    };

    await db.transaction(async (tx) => {
      await tx.insert(serverHeartbeats).values(values);
      await tx
        .update(servers)
        .set({
          currentPlayers: input.currentPlayers,
          maxPlayers: input.maxPlayers,
          status: input.status === "online" ? "active" : input.status,
          updatedAt: recordedAt,
        })
        .where(eq(servers.id, input.serverId));
      await tx
        .update(serverInstallations)
        .set({ lastHeartbeatAt: recordedAt, status: "active" })
        .where(eq(serverInstallations.id, input.installationId));
    });

    return values;
  }

  async findInstallationByApiKeyHash(apiKeyHash: string) {
    const rows = await db
      .select()
      .from(serverInstallations)
      .where(eq(serverInstallations.apiKeyHash, apiKeyHash))
      .limit(1);
    return rows[0] || null;
  }

  async listRecentHeartbeats(serverId: string, limit = 24) {
    return db
      .select()
      .from(serverHeartbeats)
      .where(eq(serverHeartbeats.serverId, serverId))
      .orderBy(desc(serverHeartbeats.recordedAt))
      .limit(limit);
  }

  async getPeakPlayers(serverId: string, hours = 24): Promise<number> {
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const rows = await db
      .select({ peak: sql<number>`coalesce(max(${serverHeartbeats.currentPlayers}), 0)` })
      .from(serverHeartbeats)
      .where(and(eq(serverHeartbeats.serverId, serverId), gte(serverHeartbeats.recordedAt, since)));
    return Number(rows[0]?.peak || 0);
  }
}

export const telemetryRepository = new TelemetryRepository();
