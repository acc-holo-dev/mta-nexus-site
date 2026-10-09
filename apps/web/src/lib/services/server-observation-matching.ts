import type { Server } from "@nexus/domain";
import {
  indexMtaObservations,
  type MtaMasterDirectory,
} from "./mta-master-directory-service";
import type { RecordServerObservationInput } from "@nexus/db";
import { observationSequenceForEndpoint } from "./server-observation-sequence.mjs";

export function buildMasterObservationCandidates(
  knownServers: readonly (
    Pick<Server, "id" | "ipAddress" | "port"> & { endpointRevision?: number }
  )[],
  directory: MtaMasterDirectory,
  observationFor = indexMtaObservations(directory.servers),
): RecordServerObservationInput[] {

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
        // The same cached snapshot can be applied before and after an
        // endpoint edit. Revision-scoped identity prevents the new endpoint
        // from colliding with the previous endpoint's immutable history.
        sourceSequence: observationSequenceForEndpoint(
          directory.fetchedAt,
          server.endpointRevision,
        ),
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
