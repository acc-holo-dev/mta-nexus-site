import type { Server } from "@nexus/domain";
import {
  normalizeMtaAddress,
  type MtaMasterDirectory,
  type MtaMasterServer,
} from "./mta-master-directory-service";
import type { RecordServerObservationInput } from "@nexus/db";

function endpointKey(address: string, port: number): string {
  return `${normalizeMtaAddress(address)}:${port}`;
}

export function buildMasterObservationCandidates(
  knownServers: readonly Pick<Server, "id" | "ipAddress" | "port">[],
  directory: MtaMasterDirectory,
): RecordServerObservationInput[] {
  const observedByEndpoint = new Map<string, MtaMasterServer>();

  for (const observed of directory.servers) {
    const key = endpointKey(observed.address, observed.port);
    if (!observedByEndpoint.has(key)) observedByEndpoint.set(key, observed);
  }

  const observedAt = new Date(directory.fetchedAt);

  return knownServers.flatMap((server) => {
    const observed = observedByEndpoint.get(
      endpointKey(server.ipAddress, server.port),
    );
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
