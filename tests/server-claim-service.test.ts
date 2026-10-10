import type { Server, User } from "@nexus/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  server: null as Server | null,
  directory: {
    isStale: false,
    fetchedAt: "2026-10-08T00:00:00.000Z",
    servers: [] as Array<Record<string, unknown>>,
  },
  canManage: true,
}));

const mocks = vi.hoisted(() => ({
  issue: vi.fn(),
  assertLive: vi.fn(),
  consume: vi.fn(),
  moderators: vi.fn(),
  dispatch: vi.fn(),
  matchesEndpoint: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  serverRepository: {
    findById: vi.fn(async () => state.server),
  },
  serverClaimChallengeRepository: {
    issue: mocks.issue,
    assertLive: mocks.assertLive,
    consumeVerifiedProof: mocks.consume,
  },
  userRepository: {
    listModeratorIds: mocks.moderators,
  },
}));

vi.mock("@nexus/security", () => ({
  generateId: vi.fn((prefix: string) => `${prefix}_test`),
}));

vi.mock("../apps/web/src/lib/services/server-service", () => ({
  serverService: {
    canManageServer: vi.fn(async () => state.canManage),
  },
}));

vi.mock("../apps/web/src/lib/services/mta-master-directory-service", () => ({
  matchesMtaEndpoint: mocks.matchesEndpoint,
  mtaMasterDirectoryService: {
    getDirectory: vi.fn(async () => state.directory),
  },
}));

vi.mock("../apps/web/src/lib/services/notification-dispatch-service", () => ({
  dispatchNotificationsBestEffort: mocks.dispatch,
}));

import {
  notifyModeratorsOfServerClaim,
  serverClaimService,
} from "../apps/web/src/lib/services/server-claim-service";

const requester = {
  id: "usr_claimant",
  username: "claimant",
  displayName: "Claimant",
  role: "user",
} as User;

const token = "NXCLAIM-ABCDEF0123456789ABCDEF01";

function server(overrides: Partial<Server> = {}): Server {
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

describe("server claim service behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.server = server();
    state.canManage = true;
    state.directory = {
      isStale: false,
      fetchedAt: "2026-10-08T00:00:00.000Z",
      servers: [],
    };
    mocks.issue.mockResolvedValue({
      id: "scc_1",
      token,
      expiresAt: new Date("2026-10-08T00:10:00.000Z"),
      server: {
        id: "srv_1",
        name: "Nexus Racing",
        ipAddress: "203.0.113.20",
        port: 22003,
      },
    });
    mocks.assertLive.mockResolvedValue(undefined);
    mocks.matchesEndpoint.mockReturnValue(true);
    mocks.consume.mockResolvedValue({
      verificationRequest: {
        id: "ver_test",
        status: "pending",
      },
      challengeId: "scc_1",
      verifiedAt: new Date("2026-10-08T00:00:01.000Z"),
    });
    mocks.moderators.mockResolvedValue(["mod_1", "mod_2"]);
    mocks.dispatch.mockResolvedValue({
      requested: 2,
      stored: 2,
      storageFailed: 0,
      push: {
        notifications: 2,
        attempted: 0,
        delivered: 0,
        failed: 0,
        stale: 0,
        deliveryErrors: 0,
      },
    });
  });

  it("issues a bounded challenge only after current ownership checks", async () => {
    await expect(serverClaimService.issueChallenge("srv_1", requester)).resolves.toMatchObject({
      challengeId: "scc_1",
      token,
      server: {
        id: "srv_1",
        name: "Nexus Racing",
        ipAddress: "203.0.113.20",
        port: 22003,
      },
    });
    expect(mocks.issue).toHaveBeenCalledWith({
      serverId: "srv_1",
      requesterId: "usr_claimant",
      auditId: "aud_test",
    });
  });

  it("uses the endpoint locked by the repository, not a stale pre-read", async () => {
    mocks.issue.mockResolvedValueOnce({
      id: "scc_new",
      token,
      expiresAt: new Date("2026-10-08T00:10:00.000Z"),
      server: {
        id: "srv_1",
        name: "Updated Network Endpoint",
        ipAddress: "198.51.100.100",
        port: 22100,
      },
    });
    const challenge = await serverClaimService.issueChallenge("srv_1", requester);
    expect(challenge.server).toEqual({
      id: "srv_1",
      name: "Updated Network Endpoint",
      ipAddress: "198.51.100.100",
      port: 22100,
    });
  });

  it("rejects verified, foreign-owned and unauthorized organization servers", async () => {
    state.server = server({ isVerified: true });
    await expect(serverClaimService.issueChallenge("srv_1", requester)).rejects.toMatchObject({
      statusCode: 409,
    });

    state.server = server({ ownerId: "usr_other" });
    await expect(serverClaimService.issueChallenge("srv_1", requester)).rejects.toMatchObject({
      statusCode: 409,
    });

    state.server = server({ organizationId: "org_1" });
    state.canManage = false;
    await expect(serverClaimService.issueChallenge("srv_1", requester)).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(mocks.issue).not.toHaveBeenCalled();
  });

  it("fails closed for a stale official directory snapshot", async () => {
    state.directory = {
      ...state.directory,
      isStale: true,
    };

    await expect(
      serverClaimService.verifyChallenge(
        { serverId: "srv_1", challengeId: "scc_1", token },
        requester,
      ),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "MTA_DIRECTORY_STALE",
    });
    expect(mocks.assertLive).toHaveBeenCalledOnce();
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it("requires a responding matching endpoint and visible token", async () => {
    state.directory = {
      ...state.directory,
      servers: [
        {
          name: "Nexus Racing",
          responding: false,
        },
      ],
    };

    await expect(
      serverClaimService.verifyChallenge(
        { serverId: "srv_1", challengeId: "scc_1", token },
        requester,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "SERVER_CONTROL_PROOF_NOT_LIVE",
    });

    state.directory = {
      ...state.directory,
      servers: [
        {
          name: "Nexus Racing without proof",
          responding: true,
        },
      ],
    };

    await expect(
      serverClaimService.verifyChallenge(
        { serverId: "srv_1", challengeId: "scc_1", token },
        requester,
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "SERVER_CONTROL_TOKEN_NOT_VISIBLE",
    });
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it("rejects invalid source timestamps before consuming proof", async () => {
    state.directory = {
      isStale: false,
      fetchedAt: "invalid-time",
      servers: [
        {
          name: `Nexus Racing ${token}`,
          responding: true,
        },
      ],
    };

    await expect(
      serverClaimService.verifyChallenge(
        { serverId: "srv_1", challengeId: "scc_1", token },
        requester,
      ),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "MTA_DIRECTORY_TIMESTAMP_INVALID",
    });
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it("consumes a live token observation into a pending moderation request", async () => {
    state.directory = {
      isStale: false,
      fetchedAt: "2026-10-08T00:00:00.000Z",
      servers: [
        {
          name: `Nexus Racing ${token}`,
          responding: true,
        },
      ],
    };

    await expect(
      serverClaimService.verifyChallenge(
        { serverId: "srv_1", challengeId: "scc_1", token },
        requester,
      ),
    ).resolves.toMatchObject({
      success: true,
      verificationRequest: {
        id: "ver_test",
        status: "pending",
      },
      proof: {
        method: "mta_master_name_challenge",
        challengeId: "scc_1",
        sourceFetchedAt: "2026-10-08T00:00:00.000Z",
      },
    });

    expect(mocks.consume).toHaveBeenCalledWith({
      id: "scc_1",
      serverId: "srv_1",
      requesterId: "usr_claimant",
      token,
      sourceFetchedAt: new Date("2026-10-08T00:00:00.000Z"),
      expectedEndpoint: { ipAddress: "203.0.113.20", port: 22003 },
      verificationRequestId: "ver_test",
      auditId: "aud_test",
    });
  });

  it("keeps moderator notification delivery secondary to durable proof", async () => {
    await notifyModeratorsOfServerClaim("Nexus Racing");
    expect(mocks.dispatch).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientId: "mod_1",
        type: "security",
        category: "security",
      }),
      expect.objectContaining({
        recipientId: "mod_2",
        type: "security",
        category: "security",
      }),
    ]);

    mocks.dispatch.mockRejectedValueOnce(new Error("notification queue unavailable"));
    await expect(notifyModeratorsOfServerClaim("Nexus Racing")).resolves.toBeUndefined();
  });

  it("uses organization management authority even when a legacy personal owner is still recorded", async () => {
    state.server = server({ organizationId: "org_1", ownerId: "usr_legacy" });
    state.canManage = true;
    await expect(serverClaimService.issueChallenge("srv_1", requester)).resolves.toHaveProperty(
      "challengeId",
    );
    state.canManage = false;
    await expect(serverClaimService.issueChallenge("srv_1", requester)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
