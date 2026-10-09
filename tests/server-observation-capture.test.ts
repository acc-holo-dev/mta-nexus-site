import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordServerObservationInput } from "@nexus/db";

const sources = vi.hoisted(() => ({ directory: vi.fn(), known: vi.fn(), record: vi.fn() }));
vi.mock("@nexus/db", () => ({
  serverRepository: { listObservableAfter: sources.known },
  serverObservationRepository: { record: sources.record },
}));
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", async importOriginal => ({
  ...await importOriginal<typeof import("../apps/web/src/lib/services/mta-master-directory-service")>(),
  mtaMasterDirectoryService: { getDirectory: sources.directory },
}));
import { captureKnownServerObservations } from "../apps/web/src/lib/services/server-observation-collector";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function fixture(count: number) {
  const known = Array.from({ length: count }, (_, index) => ({
    id: `srv_${String(index).padStart(5, "0")}`, ipAddress: `server-${index}.test`, port: 22003,
    endpointRevision: 0,
  }));
  const directory = {
    fetchedAt: "2026-10-09T00:00:00.000Z", isStale: false,
    servers: known.map(server => ({ address: server.ipAddress, port: server.port, players: 0 })),
  };
  sources.known.mockResolvedValue(known);
  sources.directory.mockResolvedValue(directory);
  return { known, directory };
}
beforeEach(() => {
  for (const source of Object.values(sources)) source.mockReset();
  sources.record.mockImplementation(async (input: RecordServerObservationInput) => input);
  fixture(2);
});
afterEach(() => vi.useRealTimers());

describe("bounded observation capture", () => {
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
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
      return input;
    });
    const capture = captureKnownServerObservations();
    try {
      await vi.advanceTimersByTimeAsync(0);
      const initialWrites = sources.record.mock.calls.length;
      await vi.runAllTimersAsync();
      expect(await capture).toMatchObject({ knownServers: 500, matchedServers: 500, recordAttempts: 500 });
      expect({ initialWrites, peak, active, elapsed: Date.now() }).toEqual({
        initialWrites: 5, peak: 5, active: 0, elapsed: 100,
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

  it.each(["rejection", "synchronous throw"])("drains the active batch after a %s and skips later batches", async failureMode => {
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
      () => { settled = true; return null; },
      error => { settled = true; return error; },
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
  });

  it("drains a pending input read before reporting a directory failure", async () => {
    const data = fixture(2);
    const known = deferred<typeof data.known>();
    const failure = new Error("Directory unavailable");
    sources.known.mockReturnValueOnce(known.promise);
    sources.directory.mockRejectedValueOnce(failure);
    let settled = false;
    const outcome = captureKnownServerObservations().catch(error => { settled = true; return error; });
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
    sources.directory.mockResolvedValue({ fetchedAt: "2026-10-09T00:00:00.000Z", isStale: true, servers: [] });
    expect(await captureKnownServerObservations()).toMatchObject({
      sourceWasStale: true, matchedServers: 0, notListedServers: 2,
      recordAttempts: 0, absenceMeansOffline: false,
    });
    expect(sources.record).not.toHaveBeenCalled();
  });

  it.each([[NaN, 500], [Infinity, 500], [-3, 1], [1.8, 1], [1000, 500]])("bounds requested limit %s to %s", async (limit, expected) => {
    fixture(501);
    const result = await captureKnownServerObservations({ limit });
    expect(sources.known).toHaveBeenCalledWith(expected + 1, undefined);
    expect(result).toMatchObject({ knownServers: expected, knownServerLimit: expected, knownServerLimitReached: true, recordAttempts: expected });
    expect(sources.record).toHaveBeenCalledTimes(expected);
  });
  it("covers a large listing in bounded ID-keyset pages with one master snapshot", async () => {
    const { known } = fixture(23);
    sources.known.mockImplementation(async (limit: number, afterId?: string) => {
      return known.filter(server => !afterId || server.id > afterId).slice(0, limit);
    });
    const result = await captureKnownServerObservations({ limit: 10, maxPages: 3 });
    expect(result).toMatchObject({
      pagesProcessed: 3,
      knownServers: 23,
      knownServerLimit: 10,
      knownServerLimitReached: false,
      nextCursor: null,
      matchedServers: 23,
      recordAttempts: 23,
    });
    expect(sources.directory).toHaveBeenCalledTimes(1);
    expect(sources.known.mock.calls).toEqual([
      [11, undefined], [11, "srv_00009"], [11, "srv_00019"],
    ]);
    expect(new Set(sources.record.mock.calls.map(([input]) => input.serverId)).size).toBe(23);
  });

  it("exposes a resumable cursor when bounded after one page", async () => {
    const { known } = fixture(23);
    sources.known.mockImplementation(async (limit: number, afterId?: string) =>
      known.filter(server => !afterId || server.id > afterId).slice(0, limit),
    );
    const first = await captureKnownServerObservations({ limit: 10 });
    expect(first).toMatchObject({
      pagesProcessed: 1, knownServers: 10,
      knownServerLimitReached: true, nextCursor: "srv_00009",
    });
    sources.record.mockClear();
    const second = await captureKnownServerObservations({
      limit: 10, maxPages: 2, afterId: first.nextCursor ?? undefined,
    });
    expect(second).toMatchObject({
      pagesProcessed: 2, knownServers: 13,
      knownServerLimitReached: false, nextCursor: null,
    });
    expect([...new Set(sources.record.mock.calls.map(([input]) => input.serverId))])
      .not.toContain("srv_00000");
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

  it("publishes a safe resume checkpoint after each fully committed page", async () => {
    const { known } = fixture(12);
    sources.known.mockImplementation(async (limit: number, afterId?: string) =>
      known.filter(server => !afterId || server.id > afterId).slice(0, limit),
    );
    const checkpoints: Array<{
      afterId: string; pagesProcessed: number; knownServers: number;
      recordAttempts: number; hasMore: boolean;
    }> = [];
    const result = await captureKnownServerObservations({
      limit: 5,
      maxPages: 3,
      onPageCompleted: checkpoint => checkpoints.push(checkpoint),
    });
    expect(result).toMatchObject({
      knownServers: 12, pagesProcessed: 3,
      recordAttempts: 12, nextCursor: null,
    });
    expect(checkpoints).toMatchObject([
      { afterId: "srv_00004", pagesProcessed: 1, knownServers: 5, recordAttempts: 5, hasMore: true },
      { afterId: "srv_00009", pagesProcessed: 2, knownServers: 10, recordAttempts: 10, hasMore: true },
      { afterId: "srv_00011", pagesProcessed: 3, knownServers: 12, recordAttempts: 12, hasMore: false },
    ]);
  });

  it("does not checkpoint an incomplete page when any write fails", async () => {
    const { known } = fixture(12);
    sources.known.mockImplementation(async (limit: number, afterId?: string) =>
      known.filter(server => !afterId || server.id > afterId).slice(0, limit),
    );
    const checkpoints: string[] = [];
    const failure = new Error("Database write rejected");
    sources.record.mockImplementation(async (input: RecordServerObservationInput) => {
      if (input.serverId === "srv_00006") throw failure;
      return input;
    });
    await expect(captureKnownServerObservations({
      limit: 5,
      maxPages: 3,
      onPageCompleted: checkpoint => checkpoints.push(checkpoint.afterId),
    })).rejects.toBe(failure);
    expect(checkpoints).toEqual(["srv_00004"]);
    expect(sources.known).toHaveBeenCalledTimes(2);
    expect(sources.record).toHaveBeenCalledTimes(10);
  });

  it("keeps the completed checkpoint when loading a later page fails", async () => {
    const { known } = fixture(8);
    const failure = new Error("Next page query failed");
    sources.known.mockResolvedValueOnce(known.slice(0, 6))
      .mockRejectedValueOnce(failure);
    const checkpoints: string[] = [];
    await expect(captureKnownServerObservations({
      limit: 5,
      maxPages: 3,
      onPageCompleted: checkpoint => checkpoints.push(checkpoint.afterId),
    })).rejects.toBe(failure);
    expect(checkpoints).toEqual(["srv_00004"]);
    expect(sources.record).toHaveBeenCalledTimes(5);
  });

  it("stops safely if the repository returns a repeated or unordered page", async () => {
    const { known } = fixture(15);
    sources.known.mockResolvedValueOnce(known.slice(0, 11))
      .mockResolvedValueOnce(known.slice(0, 11));
    await expect(captureKnownServerObservations({
      limit: 10, maxPages: 2,
    })).rejects.toThrow("Observation page is not strictly ordered");
    expect(sources.known).toHaveBeenCalledTimes(2);
    expect(sources.record).toHaveBeenCalledTimes(10);
  });

  it("limits pages to 20 and fails before reads on invalid cursors", async () => {
    const { known } = fixture(4);
    sources.known.mockImplementation(async (limit: number, afterId?: string) =>
      known.filter(server => !afterId || server.id > afterId).slice(0, limit),
    );
    const capture = await captureKnownServerObservations({ limit: 2, maxPages: Infinity });
    expect(capture.pagesProcessed).toBe(1);
    expect(capture.nextCursor).toBe("srv_00001");
    for (const invalid of ["", "x".repeat(129)]) {
      sources.directory.mockClear();
      sources.known.mockClear();
      await expect(captureKnownServerObservations({
        afterId: invalid,
      })).rejects.toThrow("Invalid observation capture cursor");
      expect(sources.directory).not.toHaveBeenCalled();
      expect(sources.known).not.toHaveBeenCalled();
    }
  });
});
