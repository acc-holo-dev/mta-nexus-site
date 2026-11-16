import type { RecordServerObservationInput } from "@nexus/db";
import { describe, expect, it, vi } from "vitest";
import {
  deferred,
  fixture,
  setupServerObservationCapture,
  sources,
} from "../helpers/server-observation-capture-harness";

vi.mock("@nexus/db", async () => {
  const { sources: harnessSources } = await import("../helpers/server-observation-capture-harness");
  return {
    serverRepository: { listObservableAfter: harnessSources.known },
    serverObservationRepository: { record: harnessSources.record },
  };
});
vi.mock("../../src/lib/services/mta-master-directory-service", async (importOriginal) => {
  const { sources: harnessSources } = await import("../helpers/server-observation-capture-harness");
  return {
    ...(await importOriginal<
      typeof import("../../src/lib/services/mta-master-directory-service")
    >()),
    mtaMasterDirectoryService: { getDirectory: harnessSources.directory },
  };
});

import { captureKnownServerObservations } from "../../src/lib/services/server-observation-collector";

setupServerObservationCapture();

describe("bounded observation capture: concurrency, drain, and stale source", () => {
  it("starts both read-only inputs together and waits for them before recording", async () => {
    const data = fixture(2);
    const directory = deferred<typeof data.directory>();
    const known = deferred<typeof data.known>();
    sources.directory.mockReturnValueOnce(directory.promise);
    sources.known.mockReturnValueOnce(known.promise);
    const capture = captureKnownServerObservations();
    try {
      expect(sources.directory).toHaveBeenCalledOnce();
      expect(sources.known).toHaveBeenCalledExactlyOnceWith(501, undefined);
      expect(sources.record).not.toHaveBeenCalled();
      directory.resolve(data.directory);
      await Promise.resolve();
      expect(sources.record).not.toHaveBeenCalled();
    } finally {
      directory.resolve(data.directory);
      known.resolve(data.known);
      expect(await capture).toMatchObject({ recordAttempts: 2, matchedServers: 2 });
    }
  });

  it("records 500 matches with at most five concurrent writes in 100 virtual time units", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    fixture(500);
    let active = 0;
    let peak = 0;
    sources.record.mockImplementation(async (input: RecordServerObservationInput) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return input;
    });
    const capture = captureKnownServerObservations();
    try {
      await vi.advanceTimersByTimeAsync(0);
      const initialWrites = sources.record.mock.calls.length;
      await vi.runAllTimersAsync();
      expect(await capture).toMatchObject({
        knownServers: 500,
        matchedServers: 500,
        recordAttempts: 500,
      });
      expect({ initialWrites, peak, active, elapsed: Date.now() }).toEqual({
        initialWrites: 5,
        peak: 5,
        active: 0,
        elapsed: 100,
      });
      expect(new Set(sources.record.mock.calls.map(([input]) => input.serverId)).size).toBe(500);
      for (const [input, endpoint] of sources.record.mock.calls) {
        const index = Number(input.serverId.split("_")[1]);
        expect(endpoint).toMatchObject({
          ipAddress: `server-${index}.test`,
          port: 22003,
          endpointRevision: 0,
        });
      }
    } finally {
      await vi.runAllTimersAsync();
      await capture;
    }
  });

  it.each(["rejection", "synchronous throw"])(
    "drains the active batch after a %s and skips later batches",
    async (failureMode) => {
      fixture(12);
      const writes = Array.from({ length: 5 }, () => deferred<unknown>());
      const failure = new Error("Observation write failed");
      sources.record.mockImplementation((input: RecordServerObservationInput) => {
        const index = sources.record.mock.calls.length - 1;
        if (index === 0 && failureMode === "synchronous throw") throw failure;
        return writes[index]?.promise ?? Promise.resolve(input);
      });
      let settled = false;
      const outcome = captureKnownServerObservations().then(
        () => {
          settled = true;
          return null;
        },
        (error) => {
          settled = true;
          return error;
        },
      );
      try {
        await vi.waitFor(() => expect(sources.record).toHaveBeenCalledTimes(5));
        if (failureMode === "rejection") writes[0].reject(failure);
        await Promise.resolve();
        await Promise.resolve();
        expect(settled).toBe(false);
        for (const write of writes.slice(1)) write.resolve(undefined);
        expect(await outcome).toBe(failure);
        expect(sources.record).toHaveBeenCalledTimes(5);
      } finally {
        for (const write of writes) write.resolve(undefined);
        await outcome;
      }
    },
  );

  it("drains a pending input read before reporting a directory failure", async () => {
    const data = fixture(2);
    const known = deferred<typeof data.known>();
    const failure = new Error("Directory unavailable");
    sources.known.mockReturnValueOnce(known.promise);
    sources.directory.mockRejectedValueOnce(failure);
    let settled = false;
    const outcome = captureKnownServerObservations().catch((error) => {
      settled = true;
      return error;
    });
    try {
      await vi.waitFor(() => expect(sources.known).toHaveBeenCalledOnce());
      await Promise.resolve();
      expect(settled).toBe(false);
      expect(sources.record).not.toHaveBeenCalled();
    } finally {
      known.resolve(data.known);
      expect(await outcome).toBe(failure);
      expect(sources.record).not.toHaveBeenCalled();
    }
  });

  it("does not replay matching observations from a stale snapshot", async () => {
    const data = fixture(20);
    sources.directory.mockResolvedValue({ ...data.directory, isStale: true });
    const result = await captureKnownServerObservations();
    expect(result).toMatchObject({
      sourceWasStale: true,
      knownServers: 20,
      matchedServers: 20,
      notListedServers: 0,
      recordAttempts: 0,
      absenceMeansOffline: false,
    });
    expect(sources.record).not.toHaveBeenCalled();
  });

  it("keeps missing endpoints unrecorded and retains stale-source diagnostics", async () => {
    sources.directory.mockResolvedValue({
      fetchedAt: "2026-10-09T00:00:00.000Z",
      isStale: true,
      servers: [],
    });
    expect(await captureKnownServerObservations()).toMatchObject({
      sourceWasStale: true,
      matchedServers: 0,
      notListedServers: 2,
      recordAttempts: 0,
      absenceMeansOffline: false,
    });
    expect(sources.record).not.toHaveBeenCalled();
  });

  it.each([
    [NaN, 500],
    [Infinity, 500],
    [-3, 1],
    [1.8, 1],
    [1000, 500],
  ])("bounds requested limit %s to %s", async (limit, expected) => {
    fixture(501);
    const result = await captureKnownServerObservations({ limit });
    expect(sources.known).toHaveBeenCalledWith(expected + 1, undefined);
    expect(result).toMatchObject({
      knownServers: expected,
      knownServerLimit: expected,
      knownServerLimitReached: true,
      recordAttempts: expected,
    });
    expect(sources.record).toHaveBeenCalledTimes(expected);
  });

  it("keeps snapshot identity distinct for servers with different endpoint revisions", async () => {
    const { known } = fixture(3);
    sources.known.mockResolvedValue(
      known.map((row, index) => ({
        ...row,
        endpointRevision: index,
      })),
    );
    const result = await captureKnownServerObservations();
    expect(result).toMatchObject({ recordAttempts: 3, matchedServers: 3 });
    expect(sources.record.mock.calls.map(([observation]) => observation.sourceSequence)).toEqual([
      "2026-10-09T00:00:00.000Z",
      "2026-10-09T00:00:00.000Z#endpoint-revision=1",
      "2026-10-09T00:00:00.000Z#endpoint-revision=2",
    ]);
    expect(sources.record.mock.calls.map(([, endpoint]) => endpoint?.endpointRevision)).toEqual([
      0, 1, 2,
    ]);
  });

  it("counts skipped old-endpoint captures without treating them as persisted rows", async () => {
    fixture(3);
    sources.record.mockResolvedValueOnce(null);
    const result = await captureKnownServerObservations();
    expect(result).toMatchObject({
      matchedServers: 3,
      recordAttempts: 3,
      recordSkippedEndpointChanges: 1,
    });
    expect(sources.record).toHaveBeenCalledTimes(3);
  });

  it("never checkpoints or paginates a stale master snapshot", async () => {
    const { known, directory } = fixture(13);
    sources.directory.mockResolvedValue({ ...directory, isStale: true });
    sources.known.mockImplementation(async (limit: number, afterId?: string) =>
      known.filter((server) => !afterId || server.id > afterId).slice(0, limit),
    );
    const checkpoints: string[] = [];
    const result = await captureKnownServerObservations({
      limit: 5,
      maxPages: 3,
      onPageCompleted: ({ afterId }) => checkpoints.push(afterId),
    });
    expect(result).toMatchObject({
      sourceWasStale: true,
      knownServers: 5,
      matchedServers: 5,
      recordAttempts: 0,
      pagesProcessed: 1,
      knownServerLimitReached: true,
      nextCursor: null,
    });
    expect(checkpoints).toEqual([]);
    expect(sources.known).toHaveBeenCalledTimes(1);
    expect(sources.record).not.toHaveBeenCalled();
  });

  it("does not attempt to persist stale snapshot matches", async () => {
    const { directory } = fixture(5);
    sources.directory.mockResolvedValue({ ...directory, isStale: true });
    const result = await captureKnownServerObservations();
    expect(result).toMatchObject({
      matchedServers: 5,
      recordAttempts: 0,
      recordSkippedEndpointChanges: 0,
    });
    expect(sources.record).not.toHaveBeenCalled();
  });
});
