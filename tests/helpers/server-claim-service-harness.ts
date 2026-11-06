import type { Server, User } from "@nexus/domain";
import { beforeEach, vi } from "vitest";

/** Mutable shared state for server claim service test doubles. */
export const serverClaimServiceState = {
  server: null as Server | null,
  directory: {
    isStale: false,
    fetchedAt: "2026-10-08T00:00:00.000Z",
    servers: [] as Array<Record<string, unknown>>,
  },
  canManage: true,
};

/** Shared fn mocks for server claim service suites. */
export const serverClaimServiceMocks = {
  issue: vi.fn(),
  assertLive: vi.fn(),
  consume: vi.fn(),
  matchesEndpoint: vi.fn(),
};

const findById = vi.fn(async () => serverClaimServiceState.server);
const canManageServer = vi.fn(async () => serverClaimServiceState.canManage);
const getDirectory = vi.fn(async () => serverClaimServiceState.directory);

/** Factory for `vi.mock("@nexus/db", …)` from suite files under `tests/`. */
export function createServerClaimServiceDbMock() {
  const m = serverClaimServiceMocks;
  return {
    serverRepository: { findById },
    serverClaimChallengeRepository: {
      issue: m.issue,
      assertLive: m.assertLive,
      consumeVerifiedProof: m.consume,
    },
  };
}

/** Factory for `vi.mock("@nexus/security", …)` from suite files under `tests/`. */
export function createServerClaimServiceSecurityMock() {
  return {
    generateId: vi.fn((prefix: string) => `${prefix}_test`),
  };
}

/** Factory for `vi.mock("../apps/web/.../server-service", …)` from suite files under `tests/`. */
export function createServerClaimServiceServerServiceMock() {
  return {
    serverService: { canManageServer },
  };
}

/** Factory for `vi.mock("../apps/web/.../mta-master-directory-service", …)` from suite files under `tests/`. */
export function createServerClaimServiceMtaMasterDirectoryMock() {
  const m = serverClaimServiceMocks;
  return {
    matchesMtaEndpoint: m.matchesEndpoint,
    mtaMasterDirectoryService: { getDirectory },
  };
}

export const serverClaimServiceRequester = {
  id: "usr_claimant",
  username: "claimant",
  displayName: "Claimant",
  role: "user",
} as User;

export const serverClaimServiceToken = "NXCLAIM-ABCDEF0123456789ABCDEF01";

export function createTestServer(overrides: Partial<Server> = {}): Server {
  return {
    id: "srv_1",
    name: "Nexus Racing",
    slug: "nexus-racing",
    mediaUrls: [],
    gameplayTags: [],
    ipAddress: "203.0.113.20",
    port: 22003,
    httpPort: 22005,
    status: "active",
    visibility: "public",
    isVerified: false,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    ...overrides,
  };
}

function resetServerClaimServiceHarness() {
  vi.clearAllMocks();
  serverClaimServiceState.server = createTestServer();
  serverClaimServiceState.canManage = true;
  serverClaimServiceState.directory = {
    isStale: false,
    fetchedAt: "2026-10-08T00:00:00.000Z",
    servers: [],
  };

  serverClaimServiceMocks.issue.mockResolvedValue({
    id: "scc_1",
    token: serverClaimServiceToken,
    expiresAt: new Date("2026-10-08T00:10:00.000Z"),
    server: {
      id: "srv_1",
      name: "Nexus Racing",
      ipAddress: "203.0.113.20",
      port: 22003,
    },
  });
  serverClaimServiceMocks.assertLive.mockResolvedValue(undefined);
  serverClaimServiceMocks.matchesEndpoint.mockReturnValue(true);
  serverClaimServiceMocks.consume.mockResolvedValue({
    verificationRequest: {
      id: "ver_test",
      status: "pending",
    },
    challengeId: "scc_1",
    verifiedAt: new Date("2026-10-08T00:00:01.000Z"),
  });
}

/** Wire shared `beforeEach` cleanup for server claim service suites. */
export function installServerClaimServiceHooks() {
  beforeEach(() => {
    resetServerClaimServiceHarness();
  });
}
