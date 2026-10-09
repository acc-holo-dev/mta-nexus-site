import type { Server } from "@nexus/domain";
import {
  indexMtaObservations,
  type MtaMasterDirectory,
} from "./mta-master-directory-service";
import type { RecordServerObservationInput } from "@nexus/db";

export function buildMasterObservationCandidates(
  knownServers: readonly Pick<Server, "id" | "ipAddress" | "port">[],
  directory: MtaMasterDirectory,
): RecordServerObservationInput[] {
  const observationFor = indexMtaObservations(directory.servers);

  const observedAt = new Date(directory.fetchedAt);
  if (!Number.isFinite(observedAt.getTime())) {
    // Do not propagate an invalid timestamp into a persisted SQL row.
    // Malformed source metadata is a failed capture, never an observation.
    throw new Error("Invalid MTA master-list observation timestamp");
  }

  return knownServers.flatMap((server) => {
    const observed = observationFor(server);
    if (!observed) return [];

    return [
      {
        serverId: server.id,
        source: "mta_master" as const,
        sourceSequence: directory.fetchedAt,
        name: observed.name,
        gameMode: observed.gameMode,
        mapName: observed.mapName,
        mtaVersion: observed.version,
        currentPlayers: observed.players,
        maxPlayers: observed.maxPlayers,
        passworded: observed.passworded,
        responding: observed.responding,
        observedAt,
      },
    ];
  });
}
