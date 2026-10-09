import {
  serverObservationRepository,
  serverRepository,
} from "@nexus/db";
import { mtaMasterDirectoryService } from "./mta-master-directory-service";
import { buildMasterObservationCandidates } from "./server-observation-matching";

const RECORD_CONCURRENCY = 5;

export async function captureKnownServerObservations(options?: {
  limit?: number;
}) {
  const requestedLimit = options?.limit ?? 500;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 500)
    : 500;
  // The CLI closes its database connection after this function settles.
  const [directoryRead, serverRead] = await Promise.allSettled([
    mtaMasterDirectoryService.getDirectory(),
    serverRepository.listObservable(limit + 1),
  ]);
  if (directoryRead.status === "rejected") throw directoryRead.reason;
  if (serverRead.status === "rejected") throw serverRead.reason;
  const directory = directoryRead.value;
  const fetchedServers = serverRead.value;
  const knownServerLimitReached = fetchedServers.length > limit;
  const knownServers = fetchedServers.slice(0, limit);
  const candidates = buildMasterObservationCandidates(
    knownServers,
    directory,
  );
  // Stale fallback is the same captured master snapshot being replayed
  // during an outage. Preserve matching diagnostics, but avoid unnecessary
  // conflict transactions (and never treat replay as a new observation).
  const recordable = directory.isStale ? [] : candidates;
  const endpointById = new Map(knownServers.map(server => [server.id, server] as const));

  for (let offset = 0; offset < recordable.length; offset += RECORD_CONCURRENCY) {
    const results = await Promise.allSettled(
      recordable.slice(offset, offset + RECORD_CONCURRENCY)
        .map(async candidate => serverObservationRepository.record(
          candidate,
          endpointById.get(candidate.serverId),
        )),
    );
    // Drain the batch before failing; later batches must not start on error.
    const failure = results.find(result => result.status === "rejected");
    if (failure) throw failure.reason;
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
    recordAttempts: recordable.length,
  });
}
