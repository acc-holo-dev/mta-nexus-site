import { beforeEach, type Mock, vi } from "vitest";

export type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

type ServerDetailBehaviorServer = {
  id: string;
  slug: string;
  name: string;
  description: string;
  ipAddress: string;
  port: number;
  status: string;
  visibility: string;
  isVerified: boolean;
  ownerId: string | null;
  organizationId: string | null;
  gameplayTags: string[];
  mediaUrls: string[];
  maxPlayers: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ServerDetailBehaviorState = {
  server: ServerDetailBehaviorServer;
  notFoundCalls: number;
};

export type ServerDetailBehaviorMocks = {
  getServer: Mock;
  directory: Mock;
  history: Mock;
  updates: Mock;
  matches: Mock;
  liveStatus: Mock;
  session: Mock;
};

/** Shared server fixture for server-detail behavior suites. */
export const state: ServerDetailBehaviorState = {
  server: {
    id: "srv_detail",
    slug: "detail-server",
    name: "Detail Server",
    description: "Server description",
    ipAddress: "203.0.113.50",
    port: 22003,
    status: "active",
    visibility: "public",
    isVerified: false,
    ownerId: null,
    organizationId: null,
    gameplayTags: [],
    mediaUrls: [],
    maxPlayers: 64,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  },
  notFoundCalls: 0,
};

/** Shared service mocks for server-detail behavior suites. */
export const mocks: ServerDetailBehaviorMocks = {
  getServer: vi.fn(),
  directory: vi.fn(),
  history: vi.fn(),
  updates: vi.fn(),
  matches: vi.fn(),
  liveStatus: vi.fn(),
  session: vi.fn(),
};

function resetServerDetailBehavior() {
  vi.clearAllMocks();
  state.notFoundCalls = 0;
  state.server = {
    ...state.server,
    visibility: "public",
    isVerified: false,
    ownerId: null,
    organizationId: null,
  };
  mocks.session.mockResolvedValue(null);
  mocks.getServer.mockResolvedValue(state.server);
  mocks.matches.mockReturnValue(true);
  mocks.liveStatus.mockReturnValue("online");
}

export function setupServerDetailBehavior() {
  beforeEach(resetServerDetailBehavior);
}
