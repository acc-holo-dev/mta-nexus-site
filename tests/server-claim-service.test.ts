import { describe, expect, it, vi } from "vitest";

vi.mock("@nexus/db", async () => {
  const { createServerClaimServiceDbMock } = await import("./helpers/server-claim-service-harness");
  return createServerClaimServiceDbMock();
});
vi.mock("@nexus/security", async () => {
  const { createServerClaimServiceSecurityMock } = await import(
    "./helpers/server-claim-service-harness"
  );
  return createServerClaimServiceSecurityMock();
});
vi.mock("../apps/web/src/lib/services/server-service", async () => {
  const { createServerClaimServiceServerServiceMock } = await import(
    "./helpers/server-claim-service-harness"
  );
  return createServerClaimServiceServerServiceMock();
});
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", async () => {
  const { createServerClaimServiceMtaMasterDirectoryMock } = await import(
    "./helpers/server-claim-service-harness"
  );
  return createServerClaimServiceMtaMasterDirectoryMock();
});

import { serverClaimService } from "../apps/web/src/lib/services/server-claim-service";
import {
  installServerClaimServiceHooks,
  serverClaimServiceMocks as mocks,
  serverClaimServiceRequester as requester,
  serverClaimServiceState as state,
  serverClaimServiceToken as token,
} from "./helpers/server-claim-service-harness";

installServerClaimServiceHooks();

describe("server claim service behavior", () => {
  it("issues a bounded challenge only after current ownership checks", async () => {
    await expect(
      serverClaimService.issueChallenge("srv_1", requester, "test-session"),
    ).resolves.toMatchObject({
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
      currentToken: "test-session",
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
    const challenge = await serverClaimService.issueChallenge("srv_1", requester, "test-session");
    expect(challenge.server).toEqual({
      id: "srv_1",
      name: "Updated Network Endpoint",
      ipAddress: "198.51.100.100",
      port: 22100,
    });
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
        "test-session",
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
        "test-session",
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
        "test-session",
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
        "test-session",
      ),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "MTA_DIRECTORY_TIMESTAMP_INVALID",
    });
    expect(mocks.consume).not.toHaveBeenCalled();
  });
});
