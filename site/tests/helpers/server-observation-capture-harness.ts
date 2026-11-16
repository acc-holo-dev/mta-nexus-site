import { afterEach, beforeEach, type Mock, vi } from "vitest";

export type ServerObservationCaptureSources = {
  directory: Mock;
  known: Mock;
  record: Mock;
};

/** Shared repository/service mocks for server-observation-capture suites. */
export const sources: ServerObservationCaptureSources = {
  directory: vi.fn(),
  known: vi.fn(),
  record: vi.fn(),
};

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

export function fixture(count: number) {
  const known = Array.from({ length: count }, (_, index) => ({
    id: `srv_${String(index).padStart(5, "0")}`,
    ipAddress: `server-${index}.test`,
    port: 22003,
    endpointRevision: 0,
  }));
  const directory = {
    fetchedAt: "2026-10-09T00:00:00.000Z",
    isStale: false,
    servers: known.map((server) => ({ address: server.ipAddress, port: server.port, players: 0 })),
  };
  sources.known.mockResolvedValue(known);
  sources.directory.mockResolvedValue(directory);
  return { known, directory };
}

function resetServerObservationCapture() {
  for (const source of Object.values(sources)) source.mockReset();
  sources.record.mockImplementation(async (input: unknown) => input);
  fixture(2);
}

/** Register shared beforeEach/afterEach for observation-capture suites. */
export function setupServerObservationCapture() {
  beforeEach(resetServerObservationCapture);
  afterEach(() => vi.useRealTimers());
}
