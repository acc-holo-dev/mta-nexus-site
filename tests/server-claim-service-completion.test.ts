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
  createTestServer,
  installServerClaimServiceHooks,
  serverClaimServiceMocks as mocks,
  serverClaimServiceRequester as requester,
  serverClaimServiceState as state,
  serverClaimServiceToken as token,
} from "./helpers/server-claim-service-harness";

installServerClaimServiceHooks();

describe("server claim service completion", () => {
  it("rejects verified, foreign-owned and unauthorized organization servers", async () => {
    state.server = createTestServer({ isVerified: true });
    await expect(
      serverClaimService.issueChallenge("srv_1", requester, "test-session"),
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    state.server = createTestServer({ ownerId: "usr_other" });
    await expect(
      serverClaimService.issueChallenge("srv_1", requester, "test-session"),
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    state.server = createTestServer({ organizationId: "org_1" });
    state.canManage = false;
    await expect(
      serverClaimService.issueChallenge("srv_1", requester, "test-session"),
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(mocks.issue).not.toHaveBeenCalled();
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
        "test-session",
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
      currentToken: "test-session",
      token,
      sourceFetchedAt: new Date("2026-10-08T00:00:00.000Z"),
      expectedEndpoint: { ipAddress: "203.0.113.20", port: 22003 },
      verificationRequestId: "ver_test",
      auditId: "aud_test",
    });
  });

  it("uses organization management authority even when a legacy personal owner is still recorded", async () => {
    state.server = createTestServer({ organizationId: "org_1", ownerId: "usr_legacy" });
    state.canManage = true;
    await expect(
      serverClaimService.issueChallenge("srv_1", requester, "test-session"),
    ).resolves.toHaveProperty("challengeId");
    state.canManage = false;
    await expect(
      serverClaimService.issueChallenge("srv_1", requester, "test-session"),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
