import { AppError, canManageOrganization } from "@nexus/domain";
import { and, asc, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../client";
import { auditEvents, organizationMembers, organizations, users } from "../schema";
import { storeOrganizationAccessNotice } from "./organization-access-notice";
import { organizationWorkspaceAccess } from "./organization-workspace";

const actions = [
  "organization.created",
  "organization.profile_updated",
  "organization.member_added",
  "organization.member_updated",
  "organization.member_removed",
  "organization.member_left",
  "organization.ownership_transferred",
];
const revision = sql`greatest(clock_timestamp(), date_trunc('milliseconds', ${organizations.updatedAt}) + interval '1 millisecond')`;
class OrganizationGovernanceRepository {
  async transfer(input: {
    id: string;
    actorId: string;
    targetId: string;
    targetUsername: string;
    confirmationSlug: string;
    formerOwnerRole: "admin" | "member";
    expectedUpdatedAt: Date;
    memberId: string;
    auditId: string;
  }) {
    return db.transaction(async (tx) => {
      const { organization, role } = await organizationWorkspaceAccess(
        tx,
        input.id,
        input.actorId,
        true,
      );
      if (role !== "owner" || organization.ownerId !== input.actorId)
        throw new AppError("Actual owner required", 403, "OWNERSHIP_OWNER_REQUIRED");
      if (organization.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
        throw new AppError("Organization changed", 409, "CONFLICT");
      if (input.confirmationSlug !== organization.slug)
        throw new AppError(
          "Organization confirmation mismatch",
          400,
          "OWNERSHIP_CONFIRMATION_REQUIRED",
        );
      if (input.targetId === input.actorId)
        throw new AppError("Already owner", 400, "OWNERSHIP_TARGET_INVALID");
      // Organization writes lock the parent first. Lock affected memberships in a
      // stable order; preserve every existing custom/commercial permission.
      const members = await tx
        .select({
          id: organizationMembers.id,
          userId: organizationMembers.userId,
          role: organizationMembers.role,
        })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, input.id),
            inArray(organizationMembers.userId, [input.actorId, input.targetId]),
          ),
        )
        .orderBy(asc(organizationMembers.userId))
        .for("update");
      const targetMember = members.find((member) => member.userId === input.targetId);
      if (!targetMember || !["admin", "developer", "member"].includes(targetMember.role))
        throw new AppError("Current team member required", 409, "OWNERSHIP_TARGET_INVALID");
      const [target] = await tx
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(and(eq(users.id, input.targetId), eq(users.username, input.targetUsername)))
        .for("share")
        .limit(1);
      if (!target) throw new AppError("Selected member changed", 409, "OWNERSHIP_TARGET_INVALID");
      await tx
        .update(organizationMembers)
        .set({ role: "owner" })
        .where(eq(organizationMembers.id, targetMember.id));
      const former = members.find((member) => member.userId === input.actorId);
      if (former)
        await tx
          .update(organizationMembers)
          .set({ role: input.formerOwnerRole })
          .where(eq(organizationMembers.id, former.id));
      else
        await tx.insert(organizationMembers).values({
          id: input.memberId,
          organizationId: input.id,
          userId: input.actorId,
          role: input.formerOwnerRole,
          permissions: [],
        });
      const [updated] = await tx
        .update(organizations)
        .set({ ownerId: input.targetId, updatedAt: revision })
        .where(eq(organizations.id, input.id))
        .returning();
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.actorId,
        actorType: "user",
        action: "organization.ownership_transferred",
        targetId: input.id,
        targetType: "organization",
        details: {
          previousOwnerId: input.actorId,
          newOwnerId: input.targetId,
          formerOwnerRole: input.formerOwnerRole,
        },
      });
      await storeOrganizationAccessNotice(
        tx,
        updated,
        input.targetId,
        "ownership_gained",
        input.auditId,
      );
      await storeOrganizationAccessNotice(
        tx,
        updated,
        input.actorId,
        "ownership_transferred",
        input.auditId,
      );
      return {
        organization: updated,
        role: input.formerOwnerRole,
        owner: target,
        previousOwnerId: input.actorId,
      };
    });
  }
  async history(id: string, actorId: string, before?: string) {
    if (before && !/^[a-zA-Z0-9_-]{1,128}$/u.test(before))
      throw new AppError("Invalid history cursor", 400, "VALIDATION_ERROR");
    return db.transaction(
      async (tx) => {
        const { organization, role } = await organizationWorkspaceAccess(tx, id, actorId);
        if (!canManageOrganization(role))
          throw new AppError("History is private", 403, "FORBIDDEN");
        const scope = and(
          eq(auditEvents.targetType, "organization"),
          eq(auditEvents.targetId, id),
          inArray(auditEvents.action, actions),
        );
        let older: SQL | undefined;
        if (before) {
          const [anchor] = await tx
            .select({
              id: auditEvents.id,
              time: sql<string>`to_char(${auditEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
            })
            .from(auditEvents)
            .where(and(scope, eq(auditEvents.id, before)))
            .limit(1);
          if (!anchor)
            throw new AppError("History page expired", 404, "ORGANIZATION_HISTORY_EXPIRED");
          older = sql`(${auditEvents.createdAt}, ${auditEvents.id}) < (${anchor.time}::timestamptz, ${anchor.id})`;
        }
        const subject = alias(users, "organization_activity_subject");
        const selectedSubject = sql`case when ${auditEvents.action} = 'organization.ownership_transferred' then ${auditEvents.details}->>'newOwnerId' else ${auditEvents.details}->>'userId' end`;
        // Never return raw details, contact/account fields, network metadata, proof,
        // or permission arrays. Legacy details are type/allowlist checked in SQL.
        const rows = await tx
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            createdAt: auditEvents.createdAt,
            actorUsername: users.username,
            actorName: users.displayName,
            subjectUsername: subject.username,
            subjectName: subject.displayName,
            fromRole: sql<
              string | null
            >`case when ${auditEvents.details}->>'from' in ('owner','admin','developer','member') then ${auditEvents.details}->>'from' end`,
            toRole: sql<
              string | null
            >`case when ${auditEvents.details}->>'to' in ('admin','developer','member') then ${auditEvents.details}->>'to' when ${auditEvents.action} = 'organization.member_added' and ${auditEvents.details}->>'role' in ('admin','developer','member') then ${auditEvents.details}->>'role' when ${auditEvents.action} = 'organization.ownership_transferred' then 'owner' end`,
            managesServers: sql<
              boolean | null
            >`case when jsonb_typeof(${auditEvents.details}->'managesServers') = 'boolean' then (${auditEvents.details}->>'managesServers')::boolean end`,
            fields: sql<
              string[]
            >`array(select value from jsonb_array_elements_text(case when jsonb_typeof(${auditEvents.details}->'fields') = 'array' then ${auditEvents.details}->'fields' else '[]'::jsonb end) as f(value) where value in ('name','description','logoUrl','websiteUrl') limit 4)`,
          })
          .from(auditEvents)
          .leftJoin(users, eq(users.id, auditEvents.actorId))
          .leftJoin(subject, eq(subject.id, selectedSubject))
          .where(and(scope, older))
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(21);
        const items = rows.slice(0, 20);
        return {
          organization: { id: organization.id, name: organization.name, slug: organization.slug },
          items,
          hasMore: rows.length > 20,
          nextCursor: rows.length > 20 ? (items.at(-1)?.id ?? null) : null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
export const organizationGovernanceRepository = new OrganizationGovernanceRepository();
