import { eq, desc, and, gte, sql } from "drizzle-orm";
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
    const values = {
      id: generateId("ins"),
      installationId: input.installationId,
      serverId: input.serverId,
      status: input.status,
      currentPlayers: input.currentPlayers,
      maxPlayers: input.maxPlayers,
      moduleVersion: input.moduleVersion,
      mtaVersion: input.mtaVersion,
      recordedAt: new Date(),
    };

    await db.insert(serverHeartbeats).values(values);

    // Update live server statistics from real telemetry
    await db
      .update(servers)
      .set({
        currentPlayers: input.currentPlayers,
        maxPlayers: input.maxPlayers,
        status: input.status === "online" ? "active" : input.status,
        updatedAt: new Date(),
      })
      .where(eq(servers.id, input.serverId));

    // Touch installation last heartbeat
    await db
      .update(serverInstallations)
      .set({ lastHeartbeatAt: new Date(), status: "active" })
      .where(eq(serverInstallations.id, input.installationId));

    return values;
  }

  async findInstallationByApiKey(apiKeyHash: string) {
    const rows = await db
      .select()
      .from(serverInstallations)
      .where(eq(serverInstallations.apiKeyHash, apiKeyHash))
      .limit(1);
    return rows[0] || null;
  }

  async listRecentHeartbeats(serverId: string, limit = 24) {
    const rows = await db
      .select()
      .from(serverHeartbeats)
      .where(eq(serverHeartbeats.serverId, serverId))
      .orderBy(desc(serverHeartbeats.recordedAt))
      .limit(limit);
    return rows;
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
