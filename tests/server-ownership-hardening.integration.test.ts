import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
import {
  db,
  organizationMembers,
  organizationRepository,
  serverRepository,
  sessionRepository,
  userRepository,
  verificationRepository,
} from "@nexus/db";
import { POST as registerServer } from "../apps/web/src/app/api/servers/route";
import { PATCH as updateServer } from "../apps/web/src/app/api/servers/[id]/route";
import { POST as requestVerification } from "../apps/web/src/app/api/verification/route";

function jsonRequest(
  url: string,
  method: "POST" | "PATCH",
  token: string,
  body: Record<string, unknown>,
) {
  return new NextRequest(url, {
    method,
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      cookie: `nexus_session=${token}`,
    },
    body: JSON.stringify(body),
  });
}

describe("server ownership hardening integration", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("registers through the trusted request-IP wrapper in test runtime", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    // Server slugs only allow [a-z0-9-], so derive a slug-safe variant.
    const slugSuffix = suffix.replace(/[^a-z0-9-]/g, "-");
    const userId = `usr_srv_register_${suffix}`;
    const token = `tok_srv_register_${suffix}`;
    const port = 12_000 + ((Date.now() + process.pid) % 40_000);

    await userRepository.create({
      id: userId,
      email: `srv_register_${suffix}@nexus.test`,
      username: `srv_register_${suffix}`,
      displayName: "Server Register User",
      role: "user",
    });
    await sessionRepository.create({
      id: `ses_srv_register_${suffix}`,
      userId,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const response = await registerServer(
      jsonRequest("http://nexus.test/api/servers", "POST", token, {
        name: "Trusted IP Registration",
        slug: `trusted-ip-registration-${slugSuffix}`,
        description: "Server registration route integration coverage.",
        ipAddress: "198.51.100.201",
        port,
        httpPort: port + 1,
        maxPlayers: 64,
        visibility: "private",
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      server: {
        ownerId: userId,
        status: "active",
        visibility: "private",
      },
    });
  });

  it("allows organization owner and manage_servers member while denying an outsider", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const ownerId = `usr_org_owner_${suffix}`;
    const managerId = `usr_org_manager_${suffix}`;
    const outsiderId = `usr_org_outsider_${suffix}`;
    const organizationId = `org_server_${suffix}`;
    const serverId = `srv_org_${suffix}`;
    const ownerToken = `tok_org_owner_${suffix}`;
    const managerToken = `tok_org_manager_${suffix}`;
    const outsiderToken = `tok_org_outsider_${suffix}`;
    const port = 13_000 + ((Date.now() + process.pid) % 40_000);

    for (const [id, label, token] of [
      [ownerId, "owner", ownerToken],
      [managerId, "manager", managerToken],
      [outsiderId, "outsider", outsiderToken],
    ] as const) {
      await userRepository.create({
        id,
        email: `srv_org_${label}_${suffix}@nexus.test`,
        username: `srv_org_${label}_${suffix}`,
        displayName: `Server Org ${label}`,
        role: "user",
      });
      await sessionRepository.create({
        id: `ses_${label}_${suffix}`,
        userId: id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
    }

    await organizationRepository.create({
      id: organizationId,
      name: "Server Management Org",
      slug: `server-management-org-${suffix}`,
      ownerId,
    });
    await db.insert(organizationMembers).values({
      id: `om_server_${suffix}`,
      organizationId,
      userId: managerId,
      role: "member",
      permissions: ["manage_servers"],
      createdAt: new Date(),
    });
    await serverRepository.create({
      id: serverId,
      name: "Organization Managed Server",
      slug: `organization-managed-server-${suffix}`,
      ipAddress: "198.51.100.202",
      port,
      organizationId,
      status: "active",
      visibility: "private",
      isVerified: false,
      gameplayTags: [],
      mediaUrls: [],
    });

    const ownerUpdate = await updateServer(
      jsonRequest(`http://nexus.test/api/servers/${serverId}`, "PATCH", ownerToken, {
        description: "Updated by organization owner.",
      }),
      { params: Promise.resolve({ id: serverId }) },
    );
    expect(ownerUpdate.status).toBe(200);

    const managerUpdate = await updateServer(
      jsonRequest(`http://nexus.test/api/servers/${serverId}`, "PATCH", managerToken, {
        description: "Updated by delegated manager.",
      }),
      { params: Promise.resolve({ id: serverId }) },
    );
    expect(managerUpdate.status).toBe(200);

    const outsiderUpdate = await updateServer(
      jsonRequest(`http://nexus.test/api/servers/${serverId}`, "PATCH", outsiderToken, {
        description: "Unauthorized update.",
      }),
      { params: Promise.resolve({ id: serverId }) },
    );
    expect(outsiderUpdate.status).toBe(403);
    expect(await outsiderUpdate.json()).toMatchObject({
      error: "Server manager required",
    });
  });

  it("blocks the legacy generic server-claim path at HTTP and repository boundaries", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const userId = `usr_claim_blocked_${suffix}`;
    const token = `tok_claim_blocked_${suffix}`;
    const serverId = `srv_claim_blocked_${suffix}`;
    const port = 14_000 + ((Date.now() + process.pid) % 40_000);

    await userRepository.create({
      id: userId,
      email: `srv_claim_blocked_${suffix}@nexus.test`,
      username: `srv_claim_blocked_${suffix}`,
      displayName: "Blocked Legacy Server Claim",
      role: "user",
    });
    await sessionRepository.create({
      id: `ses_claim_blocked_${suffix}`,
      userId,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await serverRepository.create({
      id: serverId,
      name: "Challenge Required Server",
      slug: `challenge-required-${suffix}`,
      ipAddress: "198.51.100.203",
      port,
      status: "active",
      visibility: "public",
      isVerified: false,
      gameplayTags: [],
      mediaUrls: [],
    });

    const response = await requestVerification(
      jsonRequest("http://nexus.test/api/verification", "POST", token, {
        targetType: "server",
        targetId: serverId,
        proofUrl: "https://example.test/legacy-proof",
      }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "SERVER_CONTROL_CHALLENGE_REQUIRED",
    });

    await expect(
      verificationRepository.createRequest({
        requesterId: userId,
        targetType: "server",
        targetId: serverId,
        proofUrl: "https://example.test/internal-bypass",
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "SERVER_CONTROL_CHALLENGE_REQUIRED",
    });

    expect(await verificationRepository.findPendingForAnyRequester("server", serverId)).toBeNull();
  });
});
