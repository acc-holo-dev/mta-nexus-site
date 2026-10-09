import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  servers,
  serverObservations,
  serverObservationRepository,
  type RecordServerObservationInput,
} from "@nexus/db";

async function withServer(run: (id: string) => Promise<void>) {
  const suffix = `${Date.now().toString(36)}_${process.pid}_${Math.random().toString(36).slice(2, 10)}`;
  const id = `srv_observation_freshness_${suffix}`;
  await db.insert(servers).values({
    id,
    slug: `observation-freshness-${suffix.replace(/_/gu, "-")}`,
    name: "Observation freshness test",
    ipAddress: `observation-${suffix}.test`,
    port: 22003,
  });
  try {
    await run(id);
  } finally {
    // CASCADE removes observation history with the disposable test server.
    await db.delete(servers).where(eq(servers.id, id));
  }
}

function sample(
  serverId: string,
  observedAt: string,
  players: number,
  source: RecordServerObservationInput["source"] = "mta_master",
): RecordServerObservationInput {
  return {
    serverId,
    source,
    sourceSequence: observedAt,
    observedAt: new Date(observedAt),
    currentPlayers: players,
    maxPlayers: 128,
    responding: true,
  };
}

async function liveState(serverId: string) {
  const [state] = await db.select({
    currentPlayers: servers.currentPlayers,
    maxPlayers: servers.maxPlayers,
    lastObservedAt: servers.lastObservedAt,
    observationSource: servers.observationSource,
    name: servers.name,
  }).from(servers).where(eq(servers.id, serverId));
  return state;
}

describe("MTA observation freshness (real PostgreSQL)", () => {
  it("retains newer live state when an older snapshot arrives late", async () => {
    await withServer(async serverId => {
      const newer = sample(serverId, "2026-10-09T12:00:00.000Z", 51);
      const older = sample(serverId, "2026-10-09T11:00:00.000Z", 13);
      const first = await serverObservationRepository.record(newer);
      await serverObservationRepository.record(older);
      // An equal timestamp from another source is preserved in history,
      // but must not overwrite the first accepted current snapshot.
      await serverObservationRepository.record({
        ...newer, source: "mta_query", sourceSequence: "query-at-noon",
        currentPlayers: 70,
      });
      // Replaying the same source sequence should not update current state
      // or create an additional immutable observation.
      const duplicate = await serverObservationRepository.record({
        ...newer, currentPlayers: 999,
      });
      expect(duplicate.id).toBe(first.id);
      expect(duplicate.currentPlayers).toBe(51);
      expect(duplicate.createdAt).toEqual(first.createdAt);
      expect(duplicate.observedAt).toEqual(first.observedAt);

      const live = await liveState(serverId);
      expect(live).toMatchObject({
        currentPlayers: 51,
        maxPlayers: 128,
        observationSource: "mta_master",
        name: "Observation freshness test",
      });
      expect(live?.lastObservedAt?.toISOString()).toBe(newer.observedAt.toISOString());

      const history = await db.select().from(serverObservations)
        .where(eq(serverObservations.serverId, serverId));
      expect(history).toHaveLength(3);
      expect(history.map(item => item.currentPlayers).sort((a, b) => (a ?? 0) - (b ?? 0)))
        .toEqual([13, 51, 70]);
    });
  });

  it("returns the one persisted observation for concurrent identical snapshots", async () => {
    await withServer(async serverId => {
      const snapshot = sample(serverId, "2026-10-09T14:00:00.000Z", 27);
      const [first, second] = await Promise.all([
        serverObservationRepository.record(snapshot),
        serverObservationRepository.record(snapshot),
      ]);
      expect(first.id).toBe(second.id);
      expect(first.currentPlayers).toBe(27);
      expect(second.currentPlayers).toBe(27);
      expect(first.createdAt).toEqual(second.createdAt);
      const history = await db.select().from(serverObservations)
        .where(eq(serverObservations.serverId, serverId));
      expect(history).toHaveLength(1);
      expect(history[0]?.id).toBe(first.id);
      expect((await liveState(serverId))?.currentPlayers).toBe(27);
    });
  });

  it("accepts independent observations when source sequence is omitted", async () => {
    await withServer(async serverId => {
      const base = sample(serverId, "2026-10-09T15:00:00.000Z", 11);
      const first = await serverObservationRepository.record({
        ...base, sourceSequence: undefined,
      });
      const second = await serverObservationRepository.record({
        ...base, sourceSequence: undefined,
        observedAt: new Date("2026-10-09T15:01:00.000Z"),
        currentPlayers: 12,
      });
      expect(first.id).not.toBe(second.id);
      expect((await liveState(serverId))?.currentPlayers).toBe(12);
      expect(await db.select().from(serverObservations)
        .where(eq(serverObservations.serverId, serverId))).toHaveLength(2);
    });
  });

  it("handles concurrent writers and a later genuine refresh", async () => {
    await withServer(async serverId => {
      const older = sample(serverId, "2026-10-09T09:00:00.000Z", 8);
      const newer = sample(serverId, "2026-10-09T10:00:00.000Z", 35);
      await Promise.all([
        serverObservationRepository.record(newer),
        serverObservationRepository.record(older),
      ]);
      expect((await liveState(serverId))?.currentPlayers).toBe(35);
      expect((await liveState(serverId))?.lastObservedAt?.toISOString())
        .toBe(newer.observedAt.toISOString());

      const latest = sample(serverId, "2026-10-09T11:00:00.000Z", 60);
      await serverObservationRepository.record(latest);
      expect((await liveState(serverId))?.currentPlayers).toBe(60);
      expect((await liveState(serverId))?.lastObservedAt?.toISOString())
        .toBe(latest.observedAt.toISOString());
    });
  });
});
