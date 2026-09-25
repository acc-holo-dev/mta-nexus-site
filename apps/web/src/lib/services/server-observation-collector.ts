import {
  serverObservationRepository,
  serverRepository,
} from "@nexus/db";
import { mtaMasterDirectoryService } from "./mta-master-directory-service";
import { buildMasterObservationCandidates } from "./server-observation-matching";

export async function captureKnownServerObservations(options?: {
  limit?: number;
}) {
  const requestedLimit = options?.limit ?? 500;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 500)
    : 500;
  const directory = await mtaMasterDirectoryService.getDirectory();
  const fetchedServers = await serverRepository.listObservable(limit + 1);
  const knownServerLimitReached = fetchedServers.length > limit;
  const knownServers = fetchedServers.slice(0, limit);
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
    knownServerLimit: limit,
    knownServerLimitReached,
    matchedServers: candidates.length,
    notListedServers: knownServers.length - candidates.length,
    absenceMeansOffline: false as const,
    recordAttempts: candidates.length,
  });
}
