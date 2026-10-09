import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildMasterObservationCandidates } from "../apps/web/src/lib/services/server-observation-matching";
import {
  db,
  servers,
  serverObservations,
  serverObservationRepository,
  serverRepository,
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

  it("increments endpoint revisions and resets verification only for network edits", async () => {
    await withServer(async serverId => {
      const initial = await serverRepository.findById(serverId);
      if (!initial) throw new Error("Missing server");
      await db.update(servers).set({ isVerified: true })
        .where(eq(servers.id, serverId));
      const revision = async () => {
        const [row] = await db.select({ value: servers.endpointRevision })
          .from(servers).where(eq(servers.id, serverId));
        return row?.value;
      };
      expect(await revision()).toBe(0);
      await serverRepository.update(serverId, { ipAddress: initial.ipAddress, name: "Same endpoint" });
      expect(await revision()).toBe(0);
      expect((await serverRepository.findById(serverId))?.isVerified).toBe(true);
      await serverRepository.update(serverId, { port: initial.port + 1 });
      expect(await revision()).toBe(1);
      expect((await serverRepository.findById(serverId))?.isVerified).toBe(false);
      await serverRepository.update(serverId, { port: initial.port });
      expect(await revision()).toBe(2);
    });
  });

  it("clears live state on endpoint edits and rejects delayed old-endpoint telemetry", async () => {
    await withServer(async serverId => {
      const original = await serverRepository.findById(serverId);
      if (!original) throw new Error("Test server missing");
      const endpoint = { ipAddress: original.ipAddress, port: original.port };
      await serverObservationRepository.record(sample(serverId, "2026-10-09T09:00:00.000Z", 45), endpoint);
      expect((await liveState(serverId))?.currentPlayers).toBe(45);

      await serverRepository.update(serverId, { name: "Renamed", ipAddress: original.ipAddress });
      expect((await liveState(serverId))?.currentPlayers).toBe(45);

      await serverRepository.update(serverId, { port: original.port + 1 });
      expect(await liveState(serverId)).toMatchObject({
        currentPlayers: null, maxPlayers: null,
        lastObservedAt: null, observationSource: null,
      });
      const rejected = await serverObservationRepository.record(
        sample(serverId, "2026-10-09T11:00:00.000Z", 90), endpoint,
      );
      expect(rejected).toBeNull();
      expect((await liveState(serverId))?.currentPlayers).toBeNull();
      const historyAfterEdit = await db.select().from(serverObservations)
        .where(eq(serverObservations.serverId, serverId));
      expect(historyAfterEdit).toHaveLength(1);
      expect(historyAfterEdit[0]?.currentPlayers).toBe(45);

      await serverObservationRepository.record(
        sample(serverId, "2026-10-09T12:00:00.000Z", 19),
        { ipAddress: original.ipAddress, port: original.port + 1 },
      );
      expect((await liveState(serverId))?.currentPlayers).toBe(19);
      expect(await db.select().from(serverObservations)
        .where(eq(serverObservations.serverId, serverId))).toHaveLength(2);
      await serverRepository.update(serverId, { description: "Profile only" });
      expect((await liveState(serverId))?.currentPlayers).toBe(19);
    });
  });

  it("rejects already-stale endpoint history before attempting INSERT", async () => {
    await withServer(async serverId => {
      const original = await serverRepository.findById(serverId);
      if (!original) throw new Error("Missing server");
      const outdated = { ipAddress: original.ipAddress, port: original.port };
      await serverRepository.update(serverId, { ipAddress: "updated." + outdated.ipAddress });
      const result = await serverObservationRepository.record(
        sample(serverId, "2026-10-09T13:00:00.000Z", 97),
        outdated,
      );
      expect(result).toBeNull();
      expect((await liveState(serverId))?.currentPlayers).toBeNull();
      expect(await db.select().from(serverObservations)
        .where(eq(serverObservations.serverId, serverId))).toHaveLength(0);
    });
  });

  it("stores all endpoint revisions within one cached MTA snapshot without identity collisions", async () => {
    await withServer(async serverId => {
      const original = await serverRepository.findById(serverId);
      if (!original) throw new Error("Missing server");
      const fetchedAt = "2026-10-09T16:00:00.000Z";
      const alternateHost = "backup." + original.ipAddress;
      const directory = {
        fetchedAt,
        isStale: false,
        servers: [
          { address: original.ipAddress, port: original.port, players: 11 },
          { address: alternateHost, port: original.port, players: 22 },
        ],
      };
      function observationFor(endpoint: NonNullable<typeof original>) {
        const [candidate] = buildMasterObservationCandidates([endpoint], directory);
        if (!candidate) throw new Error("Expected source observation");
        return candidate;
      }

      const first = await serverObservationRepository.record(observationFor(original), original);
      expect(first?.sourceSequence).toBe(fetchedAt);
      expect(first?.currentPlayers).toBe(11);
      const identical = await serverObservationRepository.record(observationFor(original), original);
      expect(identical?.id).toBe(first?.id);

      await serverRepository.update(serverId, { ipAddress: alternateHost });
      const secondEndpoint = await serverRepository.findById(serverId);
      if (!secondEndpoint) throw new Error("Missing changed endpoint");
      expect(secondEndpoint.endpointRevision).toBe(original.endpointRevision + 1);
      const second = await serverObservationRepository.record(
        observationFor(secondEndpoint), secondEndpoint,
      );
      expect(second?.sourceSequence).toBe(fetchedAt + "#endpoint-revision=1");
      expect(second?.currentPlayers).toBe(22);
      expect((await liveState(serverId))?.currentPlayers).toBe(22);

      await serverRepository.update(serverId, { ipAddress: original.ipAddress });
      const thirdEndpoint = await serverRepository.findById(serverId);
      if (!thirdEndpoint) throw new Error("Missing restored endpoint");
      expect(thirdEndpoint.endpointRevision).toBe(original.endpointRevision + 2);
      const third = await serverObservationRepository.record(
        observationFor(thirdEndpoint), thirdEndpoint,
      );
      expect(third?.sourceSequence).toBe(fetchedAt + "#endpoint-revision=2");
      expect(third?.currentPlayers).toBe(11);
      expect((await liveState(serverId))?.currentPlayers).toBe(11);

      const history = await db.select().from(serverObservations)
        .where(eq(serverObservations.serverId, serverId));
      expect(history).toHaveLength(3);
      expect(new Set(history.map(row => row.sourceSequence)).size).toBe(3);
      expect(new Set(history.map(row => row.id)).size).toBe(3);
      expect(history.every(row => row.observedAt.toISOString() === fetchedAt)).toBe(true);
    });
  });

  it("ignores delayed A -> B -> A observations using the captured endpoint revision", async () => {
    await withServer(async serverId => {
      const original = await serverRepository.findById(serverId);
      if (!original) throw new Error("Missing server");
      const captured = {
        ipAddress: original.ipAddress,
        port: original.port,
        endpointRevision: 0,
      };
      await serverRepository.update(serverId, { port: original.port + 1 });
      await serverRepository.update(serverId, { port: original.port });
      const [state] = await db.select({ revision: servers.endpointRevision })
        .from(servers).where(eq(servers.id, serverId));
      expect(state?.revision).toBe(2);
      const replayed = await serverObservationRepository.record(
        sample(serverId, "2026-10-09T14:00:00.000Z", 77), captured,
      );
      expect(replayed).toBeNull();
      expect((await liveState(serverId))?.currentPlayers).toBeNull();
      expect(await db.select().from(serverObservations)
        .where(eq(serverObservations.serverId, serverId))).toHaveLength(0);

      const current = await serverObservationRepository.record(
        sample(serverId, "2026-10-09T14:01:00.000Z", 31),
        { ...captured, endpointRevision: 2 },
      );
      expect(current?.currentPlayers).toBe(31);
      expect((await liveState(serverId))?.currentPlayers).toBe(31);
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
