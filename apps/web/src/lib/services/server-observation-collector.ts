import {
  serverObservationRepository,
  serverRepository,
  type RecordServerObservationInput,
} from "@nexus/db";
import type { Server } from "@nexus/domain";
import {
  mtaMasterDirectoryService,
  normalizeMtaAddress,
  type MtaMasterDirectory,
  type MtaMasterServer,
} from "./mta-master-directory-service";

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

export async function captureKnownServerObservations(options?: {
  limit?: number;
}) {
  const limit = options?.limit ?? 500;
  const directory = await mtaMasterDirectoryService.getDirectory();
  const knownServers = await serverRepository.listObservable(limit);
  const candidates = buildMasterObservationCandidates(
    knownServers,
    directory,
  );

  for (const candidate of candidates) {
    await serverObservationRepository.record(candidate);
  }

  return Object.freeze({
    source: "mta_master" as const,
    sourceFetchedAt: directory.fetchedAt,
    sourceWasStale: directory.isStale,
    knownServers: knownServers.length,
    matchedServers: candidates.length,
    notListedServers: knownServers.length - candidates.length,
    absenceMeansOffline: false as const,
    recordAttempts: candidates.length,
  });
}
