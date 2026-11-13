import type { RecordServerObservationInput } from "@nexus/db";
import { describe, expect, it, vi } from "vitest";
import {
  fixture,
  setupServerObservationCapture,
  sources,
} from "./helpers/server-observation-capture-harness";

vi.mock("@nexus/db", async () => {
  const { sources: harnessSources } = await import("./helpers/server-observation-capture-harness");
  return {
    serverRepository: { listObservableAfter: harnessSources.known },
    serverObservationRepository: { record: harnessSources.record },
  };
});
vi.mock("../site/src/lib/services/mta-master-directory-service", async (importOriginal) => {
  const { sources: harnessSources } = await import("./helpers/server-observation-capture-harness");
  return {
    ...(await importOriginal<
      typeof import("../site/src/lib/services/mta-master-directory-service")
    >()),
    mtaMasterDirectoryService: { getDirectory: harnessSources.directory },
  };
});

import { captureKnownServerObservations } from "../site/src/lib/services/server-observation-collector";

setupServerObservationCapture();

describe("bounded observation capture: paging, checkpoints, and cursors", () => {
  it("covers a large listing in bounded ID-keyset pages with one master snapshot", async () => {
    const { known } = fixture(23);
    sources.known.mockImplementation(async (limit: number, afterId?: string) => {
      return known.filter((server) => !afterId || server.id > afterId).slice(0, limit);
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
      [11, undefined],
      [11, "srv_00009"],
      [11, "srv_00019"],
    ]);
    expect(new Set(sources.record.mock.calls.map(([input]) => input.serverId)).size).toBe(23);
  });

  it("exposes a resumable cursor when bounded after one page", async () => {
    const { known } = fixture(23);
    sources.known.mockImplementation(async (limit: number, afterId?: string) =>
      known.filter((server) => !afterId || server.id > afterId).slice(0, limit),
    );
    const first = await captureKnownServerObservations({ limit: 10 });
    expect(first).toMatchObject({
      pagesProcessed: 1,
      knownServers: 10,
      knownServerLimitReached: true,
      nextCursor: "srv_00009",
    });
    sources.record.mockClear();
    const second = await captureKnownServerObservations({
      limit: 10,
      maxPages: 2,
      afterId: first.nextCursor ?? undefined,
    });
    expect(second).toMatchObject({
      pagesProcessed: 2,
      knownServers: 13,
      knownServerLimitReached: false,
      nextCursor: null,
    });
    expect([...new Set(sources.record.mock.calls.map(([input]) => input.serverId))]).not.toContain(
      "srv_00000",
    );
  });

  it("publishes a safe resume checkpoint after each fully committed page", async () => {
    const { known } = fixture(12);
    sources.known.mockImplementation(async (limit: number, afterId?: string) =>
      known.filter((server) => !afterId || server.id > afterId).slice(0, limit),
    );
    const checkpoints: Array<{
      afterId: string;
      pagesProcessed: number;
      knownServers: number;
      recordAttempts: number;
      hasMore: boolean;
    }> = [];
    const result = await captureKnownServerObservations({
      limit: 5,
      maxPages: 3,
      onPageCompleted: (checkpoint) => checkpoints.push(checkpoint),
    });
    expect(result).toMatchObject({
      knownServers: 12,
      pagesProcessed: 3,
      recordAttempts: 12,
      nextCursor: null,
    });
    expect(checkpoints).toMatchObject([
      {
        afterId: "srv_00004",
        pagesProcessed: 1,
        knownServers: 5,
        recordAttempts: 5,
        hasMore: true,
      },
      {
        afterId: "srv_00009",
        pagesProcessed: 2,
        knownServers: 10,
        recordAttempts: 10,
        hasMore: true,
      },
      {
        afterId: "srv_00011",
        pagesProcessed: 3,
        knownServers: 12,
        recordAttempts: 12,
        hasMore: false,
      },
    ]);
  });

  it("does not checkpoint an incomplete page when any write fails", async () => {
    const { known } = fixture(12);
    sources.known.mockImplementation(async (limit: number, afterId?: string) =>
      known.filter((server) => !afterId || server.id > afterId).slice(0, limit),
    );
    const checkpoints: string[] = [];
    const failure = new Error("Database write rejected");
    sources.record.mockImplementation(async (input: RecordServerObservationInput) => {
      if (input.serverId === "srv_00006") throw failure;
      return input;
    });
    await expect(
      captureKnownServerObservations({
        limit: 5,
        maxPages: 3,
        onPageCompleted: (checkpoint) => checkpoints.push(checkpoint.afterId),
      }),
    ).rejects.toBe(failure);
    expect(checkpoints).toEqual(["srv_00004"]);
    expect(sources.known).toHaveBeenCalledTimes(2);
    expect(sources.record).toHaveBeenCalledTimes(10);
  });

  it("keeps the completed checkpoint when loading a later page fails", async () => {
    const { known } = fixture(8);
    const failure = new Error("Next page query failed");
    sources.known.mockResolvedValueOnce(known.slice(0, 6)).mockRejectedValueOnce(failure);
    const checkpoints: string[] = [];
    await expect(
      captureKnownServerObservations({
        limit: 5,
        maxPages: 3,
        onPageCompleted: (checkpoint) => checkpoints.push(checkpoint.afterId),
      }),
    ).rejects.toBe(failure);
    expect(checkpoints).toEqual(["srv_00004"]);
    expect(sources.record).toHaveBeenCalledTimes(5);
  });

  it("stops safely if the repository returns a repeated or unordered page", async () => {
    const { known } = fixture(15);
    sources.known
      .mockResolvedValueOnce(known.slice(0, 11))
      .mockResolvedValueOnce(known.slice(0, 11));
    await expect(
      captureKnownServerObservations({
        limit: 10,
        maxPages: 2,
      }),
    ).rejects.toThrow("Observation page is not strictly ordered");
    expect(sources.known).toHaveBeenCalledTimes(2);
    expect(sources.record).toHaveBeenCalledTimes(10);
  });

  it("limits pages to 20 and fails before reads on invalid cursors", async () => {
    const { known } = fixture(4);
    sources.known.mockImplementation(async (limit: number, afterId?: string) =>
      known.filter((server) => !afterId || server.id > afterId).slice(0, limit),
    );
    const capture = await captureKnownServerObservations({ limit: 2, maxPages: Infinity });
    expect(capture.pagesProcessed).toBe(1);
    expect(capture.nextCursor).toBe("srv_00001");
    for (const invalid of ["", "x".repeat(129)]) {
      sources.directory.mockClear();
      sources.known.mockClear();
      await expect(
        captureKnownServerObservations({
          afterId: invalid,
        }),
      ).rejects.toThrow("Invalid observation capture cursor");
      expect(sources.directory).not.toHaveBeenCalled();
      expect(sources.known).not.toHaveBeenCalled();
    }
  });
});
