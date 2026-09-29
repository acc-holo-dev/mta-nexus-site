import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../client";
import { serverObservations, servers } from "../schema";
import type { ServerObservation } from "@nexus/domain";
import { generateId } from "@nexus/security";

export type RecordServerObservationInput = Omit<
  ServerObservation,
  "id" | "createdAt"
>;

export class ServerObservationRepository {
  async record(input: RecordServerObservationInput): Promise<ServerObservation> {
    const values = { id: generateId("obs"), ...input, createdAt: new Date() };

    return db.transaction(async (tx) => {
      const inserted = await tx
        .insert(serverObservations)
        .values(values)
        .onConflictDoNothing()
        .returning();

      if (inserted[0]) {
        await tx
          .update(servers)
          .set({
            name: input.name,
            gameMode: input.gameMode,
            mapName: input.mapName,
            currentPlayers: input.currentPlayers,
            maxPlayers: input.maxPlayers,
            lastObservedAt: input.observedAt,
            observationSource: input.source,
          })
          .where(eq(servers.id, input.serverId));
      }

      return (inserted[0] ?? values) as ServerObservation;
    });
  }

  async listRecent(serverId: string, limit = 96): Promise<ServerObservation[]> {
    const boundedLimit = Math.min(Math.max(Math.floor(limit), 1), 500);
    const rows = await db
      .select()
      .from(serverObservations)
      .where(eq(serverObservations.serverId, serverId))
      .orderBy(desc(serverObservations.observedAt))
      .limit(boundedLimit);
    return rows as ServerObservation[];
  }

  async getPeakPlayers(serverId: string, hours = 24): Promise<number | null> {
    const boundedHours = Math.min(Math.max(Math.floor(hours), 1), 24 * 31);
    const since = new Date(Date.now() - boundedHours * 3_600_000);
    const rows = await db
      .select({ peak: sql<number | null>`max(${serverObservations.currentPlayers})` })
      .from(serverObservations)
      .where(
        and(
          eq(serverObservations.serverId, serverId),
          gte(serverObservations.observedAt, since)
        )
      );
    return rows[0]?.peak == null ? null : Number(rows[0].peak);
  }
}

export const serverObservationRepository = new ServerObservationRepository();
