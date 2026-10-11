import { createHash } from "node:crypto";
import type {
  AuditEvent,
  OrganizationMemberBatchAction,
  OrganizationTeamRole,
} from "@nexus/domain";
import {
  AppError,
  canChangeOrganizationMember,
  canManageOrganization,
  NotFoundError,
  withServerManagementPermission,
} from "@nexus/domain";
import { and, asc, desc, eq, exists, getTableColumns, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, organizationMembers, organizations, users } from "../schema";
import { storeOrganizationAccessNotice } from "./organization-access-notice";
import { containsPattern } from "./search-pattern";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type OrganizationFields = {
  name: string;
  description: string;
  logoUrl: string;
  websiteUrl: string;
};
type Audit = Omit<AuditEvent, "createdAt">;
const boundedPage = (page = 1) =>
  Number.isSafeInteger(page) ? Math.min(Math.max(page, 1), 9999) : 1;
const revision = sql`greatest(clock_timestamp(), date_trunc('milliseconds', ${organizations.updatedAt}) + interval '1 millisecond')`;
const publicIdentity = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
};

export async function organizationWorkspaceAccess(
  tx: Transaction,
  id: string,
  actorId: string,
  lock: boolean | "share" = false,
) {
  const query = tx.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  const [organization] = await (lock ? query.for(lock === "share" ? "share" : "update") : query);
  if (!organization) throw new NotFoundError("Organization");
  if (organization.ownerId === actorId) return { organization, role: "owner" };
  const membershipQuery = tx
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, id), eq(organizationMembers.userId, actorId)))
    .limit(1);
  const [membership] = await (lock ? membershipQuery.for("share") : membershipQuery);
  // A stale legacy owner membership never establishes ownership.
  if (!membership || !["admin", "developer", "member"].includes(membership.role))
    throw new AppError("Organization access denied", 403, "FORBIDDEN");
  return { organization, role: membership.role };
}
async function writable(tx: Transaction, id: string, actorId: string, expected: Date) {
  const current = await organizationWorkspaceAccess(tx, id, actorId, true);
  if (!canManageOrganization(current.role))
    throw new AppError("Manager required", 403, "FORBIDDEN");
  if (current.organization.updatedAt.getTime() !== expected.getTime())
    throw new AppError("Organization changed", 409, "CONFLICT");
  return current;
}
type BatchInput = {
  userIds: string[];
  change: OrganizationMemberBatchAction;
  expectedUpdatedAt: Date;
};
async function batchPlan(
  tx: Transaction,
  id: string,
  actorId: string,
  input: BatchInput,
  write: boolean,
) {
  if (
    input.userIds.length < 1 ||
    input.userIds.length > 20 ||
    new Set(input.userIds).size !== input.userIds.length ||
    input.userIds.some((value) => !/^[a-zA-Z0-9_-]{1,128}$/u.test(value))
  )
    throw new AppError("Invalid batch selection", 400, "VALIDATION_ERROR");
  const current = await organizationWorkspaceAccess(tx, id, actorId, write ? true : "share");
  if (!canManageOrganization(current.role)) throw new AppError("Access denied", 403, "FORBIDDEN");
  if (current.organization.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
    throw new AppError("Organization changed", 409, "CONFLICT");
  // Lock once in stable order. No member may disappear, change role or move scope between review and write.
  const members = await tx
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      permissions: organizationMembers.permissions,
      username: users.username,
      displayName: users.displayName,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, id),
        inArray(organizationMembers.userId, input.userIds),
      ),
    )
    .orderBy(asc(organizationMembers.userId))
    .for(write ? "update" : "share", { of: organizationMembers });
  if (members.length !== input.userIds.length)
    throw new AppError("Member not found", 404, "MEMBER_NOT_FOUND");
  const plan = members.map((member) => {
    const requestedRole = input.change.action === "role" ? input.change.role : null;
    if (
      !canChangeOrganizationMember(
        current.role,
        member.role,
        requestedRole,
        member.userId === actorId,
        member.userId === current.organization.ownerId,
      )
    )
      throw new AppError("Role is protected", 403, "MEMBER_PROTECTED");
    const role = requestedRole ?? member.role;
    const enabled =
      input.change.action === "server_access"
        ? input.change.enabled
        : member.permissions.includes("manage_servers");
    const removed = input.change.action === "remove";
    return {
      member,
      role,
      enabled,
      removed,
      changed:
        removed ||
        role !== member.role ||
        enabled !== member.permissions.includes("manage_servers"),
    };
  });
  const previewRevision = createHash("sha256")
    .update(
      JSON.stringify([
        1,
        "organization-member-batch",
        actorId,
        id,
        current.organization.updatedAt.toISOString(),
        input.change,
        members.map((member) => [
          member.id,
          member.userId,
          member.role,
          member.permissions,
          member.username,
          member.displayName,
        ]),
      ]),
    )
    .digest("hex");
  return { current, plan, previewRevision };
}
function batchPreview(result: Awaited<ReturnType<typeof batchPlan>>) {
  return {
    organizationId: result.current.organization.id,
    expectedUpdatedAt: result.current.organization.updatedAt.toISOString(),
    previewRevision: result.previewRevision,
    changedCount: result.plan.filter((value) => value.changed).length,
    members: result.plan.map(({ member, role, enabled, removed, changed }) => ({
      userId: member.userId,
      username: member.username,
      displayName: member.displayName,
      before: {
        role: member.role,
        managesServers: member.permissions.includes("manage_servers"),
        effectiveServerAccess:
          member.role === "admin" ||
          (["member", "developer"].includes(member.role) &&
            member.permissions.includes("manage_servers")),
      },
      after: removed
        ? null
        : {
            role,
            managesServers: enabled,
            effectiveServerAccess:
              role === "admin" || (["member", "developer"].includes(role) && enabled),
          },
      changed,
    })),
  };
}
async function record(tx: Transaction, id: string, audit: Audit, details: Record<string, unknown>) {
  const [updated] = await tx
    .update(organizations)
    .set({ updatedAt: revision })
    .where(eq(organizations.id, id))
    .returning();
  await tx.insert(auditEvents).values({ ...audit, details, createdAt: new Date() });
  return updated;
}

class OrganizationWorkspaceRepository {
  async previewMembers(id: string, actorId: string, input: BatchInput) {
    return db.transaction(async (tx) =>
      batchPreview(await batchPlan(tx, id, actorId, input, false)),
    );
  }
  async batchMembers(
    id: string,
    actorId: string,
    input: BatchInput & { previewRevision: string },
    audits: Audit[],
  ) {
    return db.transaction(async (tx) => {
      const result = await batchPlan(tx, id, actorId, input, true);
      if (input.previewRevision !== result.previewRevision)
        throw new AppError("Team review changed", 409, "CONFLICT");
      const changed = result.plan.filter((value) => value.changed);
      if (!changed.length) throw new AppError("No team changes", 409, "BATCH_NO_CHANGES");
      if (
        audits.length !== input.userIds.length ||
        new Set(audits.map((audit) => audit.id)).size !== audits.length
      )
        throw new AppError("Invalid batch audit", 400, "VALIDATION_ERROR");
      const ids = changed.map((value) => value.member.id);
      if (input.change.action === "remove") {
        await tx
          .delete(organizationMembers)
          .where(
            and(eq(organizationMembers.organizationId, id), inArray(organizationMembers.id, ids)),
          );
      } else {
        await tx
          .update(organizationMembers)
          .set({
            role: sql`case ${organizationMembers.id} ${sql.join(
              changed.map((value) => sql`when ${value.member.id} then ${value.role}`),
              sql` `,
            )} else ${organizationMembers.role} end`,
            permissions: sql`case ${organizationMembers.id} ${sql.join(
              changed.map(
                (value) =>
                  sql`when ${value.member.id} then ${JSON.stringify(input.change.action === "server_access" ? withServerManagementPermission(value.member.permissions, value.enabled) : value.member.permissions)}::jsonb`,
              ),
              sql` `,
            )} else ${organizationMembers.permissions} end`,
          })
          .where(
            and(eq(organizationMembers.organizationId, id), inArray(organizationMembers.id, ids)),
          );
      }
      const [organization] = await tx
        .update(organizations)
        .set({ updatedAt: revision })
        .where(eq(organizations.id, id))
        .returning();
      const events = changed.map((value) => ({
        ...audits[input.userIds.indexOf(value.member.userId)],
        actorId,
        actorType: "user" as const,
        targetType: "organization",
        targetId: id,
        action: value.removed ? "organization.member_removed" : "organization.member_updated",
        createdAt: new Date(),
        details: {
          userId: value.member.userId,
          from: value.member.role,
          to: value.removed ? null : value.role,
          ...(value.removed ? {} : { managesServers: value.enabled }),
        },
      }));
      await tx.insert(auditEvents).values(events);
      for (let index = 0; index < changed.length; index++) {
        const value = changed[index];
        await storeOrganizationAccessNotice(
          tx,
          organization,
          value.member.userId,
          value.removed ? "removed" : "updated",
          events[index].id,
        );
      }
      return {
        organization,
        changedUserIds: changed.map((value) => value.member.userId),
        previewRevision: result.previewRevision,
      };
    });
  }
  async pageMine(actorId: string, requestedPage = 1, query = "") {
    const page = boundedPage(requestedPage);
    const pattern = query.trim() ? containsPattern(query.trim().slice(0, 120)) : undefined;
    const rows = await db
      .select({
        ...getTableColumns(organizations),
        role: sql<string>`case when ${organizations.ownerId} = ${actorId} then 'owner' else (select m.role from organization_members m where m.organization_id = ${organizations.id} and m.user_id = ${actorId}) end`,
      })
      .from(organizations)
      .where(
        and(
          or(
            eq(organizations.ownerId, actorId),
            exists(
              db
                .select({ id: organizationMembers.id })
                .from(organizationMembers)
                .where(
                  and(
                    eq(organizationMembers.organizationId, organizations.id),
                    eq(organizationMembers.userId, actorId),
                    sql`${organizationMembers.role} in ('admin', 'developer', 'member')`,
                  ),
                ),
            ),
          ),
          pattern
            ? or(ilike(organizations.name, pattern), ilike(organizations.slug, pattern))
            : undefined,
        ),
      )
      .orderBy(desc(organizations.updatedAt), desc(organizations.id))
      .limit(21)
      .offset((page - 1) * 20);
    return { items: rows.slice(0, 20), page, hasMore: rows.length > 20 && page < 9999 };
  }

  async getWorkspace(id: string, actorId: string, requestedPage = 1, query = "") {
    return db.transaction(
      async (tx) => {
        const { organization, role } = await organizationWorkspaceAccess(tx, id, actorId);
        const [owner] = await tx
          .select(publicIdentity)
          .from(users)
          .where(eq(users.id, organization.ownerId))
          .limit(1);
        const page = boundedPage(requestedPage);
        const pattern = query.trim() ? containsPattern(query.trim().slice(0, 120)) : undefined;
        const members = await tx
          .select({
            ...publicIdentity,
            role: organizationMembers.role,
            managesServers: sql<boolean>`${organizationMembers.permissions} @> '["manage_servers"]'::jsonb`,
            joinedAt: organizationMembers.createdAt,
          })
          .from(organizationMembers)
          .innerJoin(users, eq(users.id, organizationMembers.userId))
          .where(
            and(
              eq(organizationMembers.organizationId, id),
              sql`${organizationMembers.userId} <> ${organization.ownerId}`,
              pattern
                ? or(ilike(users.username, pattern), ilike(users.displayName, pattern))
                : undefined,
            ),
          )
          .orderBy(asc(organizationMembers.createdAt), asc(organizationMembers.id))
          .limit(21)
          .offset((page - 1) * 20);
        return {
          organization,
          role,
          owner: owner ?? null,
          members: members.slice(0, 20),
          page,
          hasMore: members.length > 20 && page < 9999,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async create(
    id: string,
    ownerId: string,
    slug: string,
    fields: OrganizationFields,
    audit: Audit,
  ) {
    return db.transaction(async (tx) => {
      const [created] = await tx
        .insert(organizations)
        .values({
          id,
          ownerId,
          slug,
          ...fields,
          description: fields.description || null,
          logoUrl: fields.logoUrl || null,
          websiteUrl: fields.websiteUrl || null,
          isVerified: false,
        })
        .returning();
      await tx.insert(organizationMembers).values({
        id: `${id}_owner`,
        organizationId: id,
        userId: ownerId,
        role: "owner",
        permissions: [],
      });
      await tx.insert(auditEvents).values({ ...audit, details: {}, createdAt: new Date() });
      return created;
    });
  }

  async updateProfile(
    id: string,
    actorId: string,
    expected: Date,
    fields: OrganizationFields,
    audit: Audit,
  ) {
    return db.transaction(async (tx) => {
      await writable(tx, id, actorId, expected);
      const [updated] = await tx
        .update(organizations)
        .set({
          name: fields.name,
          description: fields.description || null,
          logoUrl: fields.logoUrl || null,
          websiteUrl: fields.websiteUrl || null,
          updatedAt: revision,
        })
        .where(eq(organizations.id, id))
        .returning();
      await tx.insert(auditEvents).values({
        ...audit,
        details: { fields: ["name", "description", "logoUrl", "websiteUrl"] },
        createdAt: new Date(),
      });
      return updated;
    });
  }

  async addMember(
    id: string,
    actorId: string,
    expected: Date,
    username: string,
    role: OrganizationTeamRole,
    managesServers: boolean,
    memberId: string,
    audit: Audit,
  ) {
    return db.transaction(async (tx) => {
      const current = await writable(tx, id, actorId, expected);
      if (!canChangeOrganizationMember(current.role, "member", role, false, false))
        throw new AppError("Role is protected", 403, "MEMBER_PROTECTED");
      const [target] = await tx
        .select(publicIdentity)
        .from(users)
        .where(eq(users.username, username))
        .limit(1)
        .for("share");
      if (!target) throw new AppError("User not found", 404, "MEMBER_NOT_FOUND");
      if (target.id === current.organization.ownerId)
        throw new AppError("Owner is protected", 403, "MEMBER_PROTECTED");
      const inserted = await tx
        .insert(organizationMembers)
        .values({
          id: memberId,
          organizationId: id,
          userId: target.id,
          role,
          permissions: managesServers ? ["manage_servers"] : [],
        })
        .onConflictDoNothing({
          target: [organizationMembers.organizationId, organizationMembers.userId],
        })
        .returning({ id: organizationMembers.id });
      if (!inserted.length) throw new AppError("Already a member", 409, "MEMBER_EXISTS");
      const organization = await record(tx, id, audit, { userId: target.id, role, managesServers });
      await storeOrganizationAccessNotice(tx, organization, target.id, "added", audit.id);
      return { organization, member: { ...target, role, managesServers } };
    });
  }

  async leave(id: string, actorId: string, expected: Date, audit: Audit) {
    return db.transaction(async (tx) => {
      const current = await organizationWorkspaceAccess(tx, id, actorId, true);
      if (current.organization.ownerId === actorId)
        throw new AppError("Owner is protected", 403, "MEMBER_PROTECTED");
      if (current.organization.updatedAt.getTime() !== expected.getTime())
        throw new AppError("Organization changed", 409, "CONFLICT");
      const removed = await tx
        .delete(organizationMembers)
        .where(
          and(eq(organizationMembers.organizationId, id), eq(organizationMembers.userId, actorId)),
        )
        .returning({ userId: organizationMembers.userId });
      if (!removed.length) throw new AppError("Member not found", 404, "MEMBER_NOT_FOUND");
      const organization = await record(tx, id, audit, { userId: actorId, from: current.role });
      await storeOrganizationAccessNotice(tx, organization, actorId, "left", audit.id);
      return { organization, userId: actorId, removed: true };
    });
  }

  async changeMember(
    id: string,
    actorId: string,
    expected: Date,
    userId: string,
    fields: { role: OrganizationTeamRole; managesServers: boolean } | null,
    audit: Audit,
  ) {
    return db.transaction(async (tx) => {
      const current = await writable(tx, id, actorId, expected);
      // The organization update lock serializes all team writes and conflicts with
      // existing product/server authority share locks. Never lock a child resource.
      const [member] = await tx
        .select()
        .from(organizationMembers)
        .where(
          and(eq(organizationMembers.organizationId, id), eq(organizationMembers.userId, userId)),
        )
        .limit(1)
        .for("update");
      if (userId === current.organization.ownerId)
        throw new AppError("Owner is protected", 403, "MEMBER_PROTECTED");
      if (!member) throw new AppError("Member not found", 404, "MEMBER_NOT_FOUND");
      if (
        !canChangeOrganizationMember(
          current.role,
          member.role,
          fields?.role ?? null,
          userId === actorId,
          false,
        )
      )
        throw new AppError("Role is protected", 403, "MEMBER_PROTECTED");
      if (fields)
        await tx
          .update(organizationMembers)
          .set({
            role: fields.role,
            permissions: withServerManagementPermission(member.permissions, fields.managesServers),
          })
          .where(eq(organizationMembers.id, member.id));
      else await tx.delete(organizationMembers).where(eq(organizationMembers.id, member.id));
      const organization = await record(tx, id, audit, {
        userId,
        from: member.role,
        to: fields?.role ?? null,
        ...(fields ? { managesServers: fields.managesServers } : {}),
      });
      await storeOrganizationAccessNotice(
        tx,
        organization,
        userId,
        fields ? "updated" : "removed",
        audit.id,
      );
      return {
        organization,
        userId,
        ...(fields
          ? { role: fields.role, managesServers: fields.managesServers }
          : { removed: true }),
      };
    });
  }
}
export const organizationWorkspaceRepository = new OrganizationWorkspaceRepository();
