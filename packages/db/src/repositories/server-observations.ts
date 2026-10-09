import { and, desc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../client";
import { serverObservations, servers } from "../schema";
import type { ServerObservation } from "@nexus/domain";
import { generateId } from "@nexus/security";

export type RecordServerObservationInput = Omit<
  ServerObservation,
  "id" | "createdAt"
>;

function boundedObservationInt(value: number, fallback: number, max: number): number {
  return Number.isFinite(value)
    ? Math.min(Math.max(Math.floor(value), 1), max)
    : fallback;
}

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
        // Observations are immutable history, but the denormalized current
        // values must be monotonic. A slow/stale collector can finish after
        // a newer capture. PostgreSQL rechecks this UPDATE predicate while
        // acquiring the row lock, so even concurrent writers cannot regress
        // live values or their provenance. Equal timestamps retain the first.
        // Never update editorial metadata from a remote master-list.
        await tx
          .update(servers)
          .set({
            currentPlayers: input.currentPlayers ?? null,
            maxPlayers: input.maxPlayers ?? null,
            lastObservedAt: input.observedAt,
            observationSource: input.source,
          })
          .where(and(
            eq(servers.id, input.serverId),
            or(
              isNull(servers.lastObservedAt),
              lt(servers.lastObservedAt, input.observedAt),
            ),
          ));
      }

      return (inserted[0] ?? values) as ServerObservation;
    });
  }

  async listRecent(serverId: string, limit = 96): Promise<ServerObservation[]> {
    const boundedLimit = boundedObservationInt(limit, 96, 500);
    const rows = await db
      .select()
      .from(serverObservations)
      .where(eq(serverObservations.serverId, serverId))
      .orderBy(desc(serverObservations.observedAt), desc(serverObservations.id))
      .limit(boundedLimit);
    return rows as ServerObservation[];
  }

  async listWindow(
    serverId: string,
    hours = 24,
    limit = 500,
  ): Promise<ServerObservation[]> {
    const boundedHours = boundedObservationInt(hours, 24, 24 * 31);
    const boundedLimit = boundedObservationInt(limit, 500, 500);
    const since = new Date(Date.now() - boundedHours * 3_600_000);
    const rows = await db
      .select()
      .from(serverObservations)
      .where(
        and(
          eq(serverObservations.serverId, serverId),
          gte(serverObservations.observedAt, since),
        ),
      )
      .orderBy(desc(serverObservations.observedAt), desc(serverObservations.id))
      .limit(boundedLimit);

    return (rows as ServerObservation[]).reverse();
  }

  async getPeakPlayers(serverId: string, hours = 24): Promise<number | null> {
    const boundedHours = boundedObservationInt(hours, 24, 24 * 31);
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
