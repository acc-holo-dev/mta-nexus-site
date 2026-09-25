import {
  serverObservationRepository,
  serverRepository,
} from "@nexus/db";
import { mtaMasterDirectoryService } from "./mta-master-directory-service";
import { buildMasterObservationCandidates } from "./server-observation-matching";

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
