import { serverObservationRepository, serverRepository } from "@nexus/db";
import { indexMtaObservations, mtaMasterDirectoryService } from "./mta-master-directory-service";
import { buildMasterObservationCandidates } from "./server-observation-matching";

const RECORD_CONCURRENCY = 5;
const MAX_PAGES = 20;

export type ObservationPageCheckpoint = Readonly<{
  afterId: string;
  pagesProcessed: number;
  knownServers: number;
  matchedServers: number;
  recordAttempts: number;
  recordSkippedEndpointChanges: number;
  hasMore: boolean;
}>;

export async function captureKnownServerObservations(options?: {
  limit?: number;
  maxPages?: number;
  afterId?: string;
  // Synchronous after-write hook. A checkpoint is safe to resume from even
  // if the next page's DB read or a later write batch fails.
  onPageCompleted?: (checkpoint: ObservationPageCheckpoint) => void;
}) {
  const requestedLimit = options?.limit ?? 500;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 500)
    : 500;
  const requestedPages = options?.maxPages ?? 1;
  const maxPages = Number.isFinite(requestedPages)
    ? Math.min(Math.max(Math.floor(requestedPages), 1), MAX_PAGES)
    : 1;
  const firstCursor = options?.afterId;
  if (
    firstCursor !== undefined &&
    (typeof firstCursor !== "string" || !firstCursor || firstCursor.length > 128)
  ) {
    throw new RangeError("Invalid observation capture cursor");
  }

  // Start the master read and first DB page concurrently. The CLI closes its
  // DB connection after the entire bounded capture settles.
  const [directoryRead, initialPageRead] = await Promise.allSettled([
    mtaMasterDirectoryService.getDirectory(),
    serverRepository.listObservableAfter(limit + 1, firstCursor),
  ]);
  if (directoryRead.status === "rejected") throw directoryRead.reason;
  if (initialPageRead.status === "rejected") throw initialPageRead.reason;

  const directory = directoryRead.value;
  // Construct once, not once per PostgreSQL page.
  const observationFor = indexMtaObservations(directory.servers);
  let pageRows = initialPageRead.value;
  let cursor = firstCursor;
  let nextCursor: string | null = null;
  // A stale source must never produce an actionable resume cursor, but the
  // output still reports whether the first bounded page had a sentinel.
  let listingHasMore = false;
  let pagesProcessed = 0;
  let knownServersCount = 0;
  let matchedServers = 0;
  let recordAttempts = 0;
  let recordSkippedEndpointChanges = 0;

  for (let page = 0; page < maxPages; page++) {
    const knownServers = pageRows.slice(0, limit);
    if (knownServers.length === 0) {
      nextCursor = null;
      break;
    }
    // A broken adapter must not return duplicate/reversed pages; this also
    // prevents an infinite loop if a cursor is ever used by a worker.
    for (const [index, server] of knownServers.entries()) {
      const previous = index === 0 ? cursor : knownServers[index - 1]?.id;
      if (previous && server.id <= previous) {
        throw new Error("Observation page is not strictly ordered by server ID");
      }
    }

    const candidates = buildMasterObservationCandidates(knownServers, directory, observationFor);
    const recordable = directory.isStale ? [] : candidates;
    const endpointById = new Map(knownServers.map((server) => [server.id, server] as const));
    for (let offset = 0; offset < recordable.length; offset += RECORD_CONCURRENCY) {
      const results = await Promise.allSettled(
        recordable
          .slice(offset, offset + RECORD_CONCURRENCY)
          .map(async (candidate) =>
            serverObservationRepository.record(candidate, endpointById.get(candidate.serverId)),
          ),
      );
      // Drain the batch before failing; never begin later pages on failure.
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
      // The repository returns null when an owner changes endpoint between
      // page selection and the locked observation transaction. It inserts
      // neither history nor live data for that stale endpoint.
      recordSkippedEndpointChanges += results.filter(
        (result) => result.status === "fulfilled" && result.value === null,
      ).length;
    }

    pagesProcessed++;
    knownServersCount += knownServers.length;
    matchedServers += candidates.length;
    recordAttempts += recordable.length;
    cursor = knownServers[knownServers.length - 1]!.id;
    listingHasMore = pageRows.length > limit;
    // Stale snapshots cannot prove that any current observation was written.
    // Reporting an afterId for them would let an operator skip untouched
    // rows on the next fresh capture.
    nextCursor = directory.isStale ? null : listingHasMore ? cursor : null;
    if (!directory.isStale) {
      options?.onPageCompleted?.(
        Object.freeze({
          afterId: cursor,
          pagesProcessed,
          knownServers: knownServersCount,
          matchedServers,
          recordAttempts,
          recordSkippedEndpointChanges,
          hasMore: nextCursor !== null,
        }),
      );
    }
    if (directory.isStale || !nextCursor || page + 1 >= maxPages) break;
    pageRows = await serverRepository.listObservableAfter(limit + 1, nextCursor);
  }

  return Object.freeze({
    source: "mta_master" as const,
    sourceFetchedAt: directory.fetchedAt,
    sourceWasStale: directory.isStale,
    knownServers: knownServersCount,
    knownServerLimit: limit,
    knownServerLimitReached: listingHasMore,
    matchedServers,
    notListedServers: knownServersCount - matchedServers,
    absenceMeansOffline: false as const,
    recordAttempts,
    recordSkippedEndpointChanges,
    pagesProcessed,
    nextCursor,
  });
}
