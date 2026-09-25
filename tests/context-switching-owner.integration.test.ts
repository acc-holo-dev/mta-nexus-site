import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  db,
  organizationMembers,
  organizationRepository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { authService } from "../apps/web/src/lib/services/auth-service";
import { GET as getContexts } from "../apps/web/src/app/api/auth/context/route";

describe("organization owner context switching integration", () => {
  it("shows and accepts a directly owned organization without requiring a membership row", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const ownerId = `usr_context_owner_${suffix}`;
    const outsiderId = `usr_context_outsider_${suffix}`;
    const organizationId = `org_context_owner_${suffix}`;
    const token = `tok_context_owner_${suffix}`;

    await userRepository.create({
      id: ownerId,
      email: `context_owner_${suffix}@nexus.test`,
      username: `context_owner_${suffix}`,
      displayName: "Context Owner",
      role: "user",
    });
    await userRepository.create({
      id: outsiderId,
      email: `context_outsider_${suffix}@nexus.test`,
      username: `context_outsider_${suffix}`,
      displayName: "Context Outsider",
      role: "user",
    });
    await organizationRepository.create({
      id: organizationId,
      name: "Context Owner Organization",
      slug: `context-owner-org-${suffix}`,
      ownerId,
    });
    await sessionRepository.create({
      id: `ses_context_owner_${suffix}`,
      userId: ownerId,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(
      await organizationRepository.listUserMemberships(ownerId),
    ).toHaveLength(0);

    const response = await getContexts(
      new NextRequest("http://nexus.test/api/auth/context", {
        headers: { cookie: `nexus_session=${token}` },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const ownedContexts = body.contexts.filter(
      (context: { id: string }) => context.id === organizationId,
    );
    expect(ownedContexts).toEqual([
      expect.objectContaining({
        id: organizationId,
        type: "organization",
        role: "owner",
      }),
    ]);

    const switched = await authService.switchContext(ownerId, organizationId);
    expect(switched.activeContextId).toBe(organizationId);

    await expect(
      authService.switchContext(outsiderId, organizationId),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });

    await db.insert(organizationMembers).values({
      id: `om_context_owner_${suffix}`,
      organizationId,
      userId: ownerId,
      role: "admin",
      permissions: [],
      createdAt: new Date(),
    });

    const deduped = await getContexts(
      new NextRequest("http://nexus.test/api/auth/context", {
        headers: { cookie: `nexus_session=${token}` },
      }),
    );
    const dedupedBody = await deduped.json();
    const repeated = dedupedBody.contexts.filter(
      (context: { id: string }) => context.id === organizationId,
    );
    expect(repeated).toHaveLength(1);
    expect(repeated[0]).toMatchObject({ role: "owner" });
  });
});
