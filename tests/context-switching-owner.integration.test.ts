import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import {
  auditEvents,
  authRepository,
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
    await authService.switchContext(ownerId, organizationId);
    const events = await db.select().from(auditEvents).where(
      and(
        eq(auditEvents.actorId, ownerId),
        eq(auditEvents.action, "user.context_switched"),
      ),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.details).toEqual({
      from: "personal",
      to: organizationId,
    });
  });

  it("falls back to personal when a previously selected membership context is revoked", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const ownerId = `usr_context_revoke_owner_${suffix}`;
    const memberId = `usr_context_revoke_member_${suffix}`;
    const organizationId = `org_context_revoke_${suffix}`;
    const token = `tok_context_revoke_${suffix}`;

    await userRepository.create({
      id: ownerId,
      email: `context_revoke_owner_${suffix}@nexus.test`,
      username: `context_revoke_owner_${suffix}`,
      displayName: "Context Revoke Owner",
      role: "user",
    });
    await userRepository.create({
      id: memberId,
      email: `context_revoke_member_${suffix}@nexus.test`,
      username: `context_revoke_member_${suffix}`,
      displayName: "Context Revoke Member",
      role: "user",
    });
    await organizationRepository.create({
      id: organizationId,
      name: "Context Revoke Organization",
      slug: `context-revoke-org-${suffix}`,
      ownerId,
    });
    await db.insert(organizationMembers).values({
      id: `om_context_revoke_${suffix}`,
      organizationId,
      userId: memberId,
      role: "member",
      permissions: [],
      createdAt: new Date(),
    });
    await sessionRepository.create({
      id: `ses_context_revoke_${suffix}`,
      userId: memberId,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const switched = await authService.switchContext(memberId, organizationId);
    expect(switched.activeContextId).toBe(organizationId);

    await db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, memberId),
        ),
      );

    const response = await getContexts(
      new NextRequest("http://nexus.test/api/auth/context", {
        headers: { cookie: `nexus_session=${token}` },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.activeContextId).toBe("personal");
    await expect(authService.switchContext(memberId, organizationId))
      .rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(
      body.contexts.some(
        (context: { id: string }) => context.id === organizationId,
      ),
    ).toBe(false);
  });
  it("rolls back a context write when the audit insert fails", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const userId = `usr_context_atomic_${suffix}`;
    const auditId = `aud_context_atomic_${suffix}`;
    await userRepository.create({
      id: userId,
      email: `context_atomic_${suffix}@nexus.test`,
      username: `context_atomic_${suffix}`,
      displayName: "Context Audit Test",
      role: "user",
    });
    await db.insert(auditEvents).values({
      id: auditId,
      actorId: userId,
      actorType: "user",
      action: "test.audit_collision",
      targetId: userId,
      targetType: "user",
      createdAt: new Date(),
    });

    await expect(authRepository.switchContext({
      userId, contextId: "personal", auditId,
    })).resolves.toMatchObject({ activeContextId: "personal" });
    const orgId = `org_context_atomic_${suffix}`;
    await organizationRepository.create({
      id: orgId,
      name: "Context Audit Rollback",
      slug: `context-atomic-${suffix}`,
      ownerId: userId,
    });
    await expect(authRepository.switchContext({
      userId, contextId: orgId, auditId,
    })).rejects.toThrow();
    expect((await userRepository.findById(userId))?.activeContextId).toBe("personal");
  });

});
