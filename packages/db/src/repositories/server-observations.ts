import { and, count, desc, eq, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "../client";
import { serverObservations, servers } from "../schema";
import type { Server, ServerObservation } from "@nexus/domain";
import { generateId } from "@nexus/security";

type ObservedEndpoint = Readonly<
  Pick<Server, "ipAddress" | "port"> & { endpointRevision?: number }
>;

export type RecordServerObservationInput = Omit<
  ServerObservation,
  "id" | "createdAt"
>;

function boundedObservationInt(value: number, fallback: number, max: number): number {
  return Number.isFinite(value)
    ? Math.min(Math.max(Math.floor(value), 1), max)
    : fallback;
}

type ObservationWindow = {
  windowStart: Date;
  windowEnd: Date;
  bucketSeconds: number;
  sampleLimit: number;
  summary: {
    observationCount: number;
    knownPlayerCount: number;
    observedFrom: Date | null;
    observedTo: Date | null;
    peakPlayers: number | null;
    averagePlayers: number | null;
  };
  observations: ServerObservation[];
  buckets: {
    bucketAt: Date;
    observationCount: number;
    knownPlayerCount: number;
    peakPlayers: number | null;
    averagePlayers: number | null;
    maxPlayers: number | null;
  }[];
};

export class ServerObservationRepository {
  async record(input: RecordServerObservationInput): Promise<ServerObservation>;
  async record(
    input: RecordServerObservationInput,
    expectedEndpoint: ObservedEndpoint | undefined,
  ): Promise<ServerObservation | null>;
  async record(
    input: RecordServerObservationInput,
    expectedEndpoint?: ObservedEndpoint,
  ): Promise<ServerObservation | null> {
    const values = { id: generateId("obs"), ...input, createdAt: new Date() };

    return db.transaction(async (tx) => {
      if (expectedEndpoint) {
        // Lock the listing BEFORE inserting historical data. Endpoint edits
        // use UPDATE on this same row, so an in-flight old-endpoint capture
        // cannot be attributed to a new endpoint in either live state or
        // immutable history. This lock is intentionally absent for callers
        // that do not supply endpoint identity.
        const [current] = await tx
          .select({ id: servers.id })
          .from(servers)
          .where(and(
            eq(servers.id, input.serverId),
            eq(servers.ipAddress, expectedEndpoint.ipAddress),
            eq(servers.port, expectedEndpoint.port),
            // The same host:port can be reused after A -> B -> A.
            // Capture the revision selected for this server, not just
            // its network endpoint text.
            expectedEndpoint.endpointRevision === undefined
              ? undefined
              : eq(servers.endpointRevision, expectedEndpoint.endpointRevision),
          ))
          .for("update")
          .limit(1);
        if (!current) return null;
      }

      const inserted = await tx
        .insert(serverObservations)
        .values(values)
        // Ignore only a duplicate snapshot identity, never an unexpected
        // collision of the generated observation primary key.
        .onConflictDoNothing({
          target: [
            serverObservations.source,
            serverObservations.sourceSequence,
            serverObservations.serverId,
          ],
        })
        .returning();

      if (!inserted[0]) {
        // A conflict is not a new observation. Return the actual persisted
        // row, including its original ID and immutable payload, rather than
        // inventing an object from values that PostgreSQL did not insert.
        if (input.sourceSequence == null) {
          throw new Error("Conflicting observation has no source sequence");
        }
        const [existing] = await tx
          .select()
          .from(serverObservations)
          .where(and(
            eq(serverObservations.source, input.source),
            eq(serverObservations.sourceSequence, input.sourceSequence),
            eq(serverObservations.serverId, input.serverId),
          ))
          .limit(1);
        if (!existing) {
          throw new Error("Conflicting server observation was not found");
        }
        return existing as ServerObservation;
      }

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
          // Reject delayed telemetry from the server's previous IP/port.
          ...(expectedEndpoint ? [
            eq(servers.ipAddress, expectedEndpoint.ipAddress),
            eq(servers.port, expectedEndpoint.port),
            ...(expectedEndpoint.endpointRevision === undefined
              ? []
              : [eq(servers.endpointRevision, expectedEndpoint.endpointRevision)]),
          ] : []),
          or(
            isNull(servers.lastObservedAt),
            lt(servers.lastObservedAt, input.observedAt),
          ),
        ));

      return inserted[0] as ServerObservation;
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

  async readWindow(serverId: string, hours = 24, limit = 500): Promise<ObservationWindow> {
    const boundedHours = boundedObservationInt(hours, 24, 24 * 31);
    const sampleLimit = boundedObservationInt(limit, 500, 500);
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - boundedHours * 3_600_000);
    const bucketSeconds = boundedHours <= 24 ? 3600 : boundedHours <= 168 ? 21_600 : 86_400;
    const filter = and(
      eq(serverObservations.serverId, serverId),
      eq(serverObservations.source, "mta_master"),
      gte(serverObservations.observedAt, windowStart),
      lte(serverObservations.observedAt, windowEnd),
    );
    const average = sql<number | null>`round(avg(${serverObservations.currentPlayers}), 1)`
      .mapWith((value: unknown): number | null => value == null ? null : Number(value));
    const peak = sql<number | null>`max(${serverObservations.currentPlayers})`
      .mapWith((value: unknown): number | null => value == null ? null : Number(value));
    const bucket = sql<Date>`to_timestamp(floor(extract(epoch from ${serverObservations.observedAt}) / ${bucketSeconds}) * ${bucketSeconds})`
      .mapWith(serverObservations.observedAt).as("bucket_at");

    // The summary, recent samples and chart buckets must describe the same committed rows.
    return db.transaction(async (tx) => {
      const [summary] = await tx.select({
        observationCount: count(),
        knownPlayerCount: count(serverObservations.currentPlayers),
        observedFrom: sql<Date | null>`min(${serverObservations.observedAt})`.mapWith(serverObservations.observedAt),
        observedTo: sql<Date | null>`max(${serverObservations.observedAt})`.mapWith(serverObservations.observedAt),
        peakPlayers: peak,
        averagePlayers: average,
      }).from(serverObservations).where(filter);
      if (!summary) throw new Error("Server history aggregate returned no row");

      const observations = await tx.select().from(serverObservations).where(filter)
        .orderBy(desc(serverObservations.observedAt), desc(serverObservations.id)).limit(sampleLimit);
      const buckets = await tx.select({
        bucketAt: bucket,
        observationCount: count(),
        knownPlayerCount: count(serverObservations.currentPlayers),
        peakPlayers: peak,
        averagePlayers: average,
        maxPlayers: sql<number | null>`max(${serverObservations.maxPlayers})`
          .mapWith((value: unknown): number | null => value == null ? null : Number(value)),
      }).from(serverObservations).where(filter)
        // Refer to the SELECT alias: repeated parameterized expressions use different
        // placeholders and PostgreSQL does not consider them identical GROUP BY keys.
        .groupBy(sql`"bucket_at"`).orderBy(sql`"bucket_at"`);

      return {
        windowStart, windowEnd, bucketSeconds, sampleLimit, summary,
        observations: (observations as ServerObservation[]).reverse(),
        buckets,
      };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
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
