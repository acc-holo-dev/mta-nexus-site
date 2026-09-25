import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
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
      "content-type": "application/json",
      cookie: `nexus_session=${token}`,
    },
    body: JSON.stringify(body),
  });
}

describe("server ownership hardening integration", () => {
  it("registers through the trusted request-IP wrapper in test runtime", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
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
      jsonRequest(
        "http://nexus.test/api/servers",
        "POST",
        token,
        {
          name: "Trusted IP Registration",
          slug: `trusted-ip-registration-${suffix}`,
          description: "Server registration route integration coverage.",
          ipAddress: "198.51.100.201",
          port,
          httpPort: port + 1,
          maxPlayers: 64,
          visibility: "private",
        },
      ),
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
      jsonRequest(
        `http://nexus.test/api/servers/${serverId}`,
        "PATCH",
        ownerToken,
        { description: "Updated by organization owner." },
      ),
      { params: Promise.resolve({ id: serverId }) },
    );
    expect(ownerUpdate.status).toBe(200);

    const managerUpdate = await updateServer(
      jsonRequest(
        `http://nexus.test/api/servers/${serverId}`,
        "PATCH",
        managerToken,
        { description: "Updated by delegated manager." },
      ),
      { params: Promise.resolve({ id: serverId }) },
    );
    expect(managerUpdate.status).toBe(200);

    const outsiderUpdate = await updateServer(
      jsonRequest(
        `http://nexus.test/api/servers/${serverId}`,
        "PATCH",
        outsiderToken,
        { description: "Unauthorized update." },
      ),
      { params: Promise.resolve({ id: serverId }) },
    );
    expect(outsiderUpdate.status).toBe(403);
    expect(await outsiderUpdate.json()).toMatchObject({
      error: "You do not manage this server",
    });
  });

  it("serializes competing ownership claims so only one requester becomes pending", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const firstId = `usr_claim_a_${suffix}`;
    const secondId = `usr_claim_b_${suffix}`;
    const firstToken = `tok_claim_a_${suffix}`;
    const secondToken = `tok_claim_b_${suffix}`;
    const serverId = `srv_claim_race_${suffix}`;
    const port = 14_000 + ((Date.now() + process.pid) % 40_000);

    for (const [id, label, token] of [
      [firstId, "a", firstToken],
      [secondId, "b", secondToken],
    ] as const) {
      await userRepository.create({
        id,
        email: `srv_claim_${label}_${suffix}@nexus.test`,
        username: `srv_claim_${label}_${suffix}`,
        displayName: `Server Claim ${label}`,
        role: "user",
      });
      await sessionRepository.create({
        id: `ses_claim_${label}_${suffix}`,
        userId: id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
    }

    await serverRepository.create({
      id: serverId,
      name: "Unowned Claim Target",
      slug: `unowned-claim-target-${suffix}`,
      ipAddress: "198.51.100.203",
      port,
      status: "active",
      visibility: "public",
      isVerified: false,
      gameplayTags: [],
      mediaUrls: [],
    });

    const [first, second] = await Promise.all([
      requestVerification(
        jsonRequest(
          "http://nexus.test/api/verification",
          "POST",
          firstToken,
          {
            targetType: "server",
            targetId: serverId,
            proofUrl: "https://example.test/proof/a",
            notes: "First ownership claim evidence.",
          },
        ),
      ),
      requestVerification(
        jsonRequest(
          "http://nexus.test/api/verification",
          "POST",
          secondToken,
          {
            targetType: "server",
            targetId: serverId,
            proofUrl: "https://example.test/proof/b",
            notes: "Second ownership claim evidence.",
          },
        ),
      ),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);

    const pending = await verificationRepository.findPendingForAnyRequester(
      "server",
      serverId,
    );
    expect(pending).toBeTruthy();
    expect([firstId, secondId]).toContain(pending?.requesterId);

    const sameRequesterRetry = await requestVerification(
      jsonRequest(
        "http://nexus.test/api/verification",
        "POST",
        pending?.requesterId === firstId ? firstToken : secondToken,
        {
          targetType: "server",
          targetId: serverId,
          proofUrl: "https://example.test/proof/retry",
          notes: "Duplicate claim retry.",
        },
      ),
    );
    expect(sameRequesterRetry.status).toBe(409);
  });
});
