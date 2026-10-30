import {
  AppError,
  type ChangeHistoryCursor,
  type ChangeHistoryFilters,
  canManageOrganization,
  ORGANIZATION_CHANGE_ACTIONS,
  ORGANIZATION_CHANGE_GROUPS,
  type OrganizationChangeGroup,
  UnauthorizedError,
} from "@nexus/domain";
import { and, asc, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../client";
import { auditEvents, organizationMembers, organizations, users } from "../schema";
import type { ResourceTransaction } from "../transaction";
import { lockInitiatingSession } from "./initiating-session";
import { storeOrganizationAccessNotice } from "./organization-access-notice";
import { organizationWorkspaceAccess } from "./organization-workspace";
import {
  changeHistoryBounds,
  changeHistoryContext,
  changeHistoryWindow,
} from "./private-change-history-window";
import { containsPattern } from "./search-pattern";

const actions = ORGANIZATION_CHANGE_ACTIONS;
const revision = sql`greatest(clock_timestamp(), date_trunc('milliseconds', ${organizations.updatedAt}) + interval '1 millisecond')`;
type HistoryPage = {
  organization: { id: string; name: string; slug: string };
  items: {
    id: string;
    action: string;
    createdAt: string;
    actorUsername: string | null;
    actorName: string | null;
    subjectUsername: string | null;
    subjectName: string | null;
    fromRole: string | null;
    toRole: string | null;
    managesServers: boolean | null;
    fields: string[];
  }[];
  hasMore: boolean;
  nextCursor: string | null;
};
type FilteredHistoryPage = Omit<HistoryPage, "nextCursor"> & {
  nextCursor: ChangeHistoryCursor | null;
  until: string;
  period: ChangeHistoryFilters<OrganizationChangeGroup>["period"];
  group: OrganizationChangeGroup;
  query: string;
};
async function lockTransferActors(
  tx: ResourceTransaction,
  actorId: string,
  targetId: string,
  targetUsername: string,
  expectedPasswordHash: string,
) {
  const actors = await tx
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(inArray(users.id, [actorId, targetId]))
    .orderBy(asc(users.id))
    .for("share");
  const actor = actors.find((row) => row.id === actorId);
  if (!actor) throw new UnauthorizedError();
  // Fresh-auth recheck: a concurrent password change must invalidate the transfer.
  if (!actor.passwordHash || actor.passwordHash !== expectedPasswordHash) {
    throw new AppError("Current password is incorrect", 401, "FRESH_AUTH_REQUIRED");
  }
  const target = actors.find((row) => row.id === targetId && row.username === targetUsername);
  if (!target) throw new AppError("Selected member changed", 409, "OWNERSHIP_TARGET_INVALID");
  return target;
}
class OrganizationGovernanceRepository {
  async transfer(input: {
    id: string;
    actorId: string;
    currentToken: string;
    targetId: string;
    targetUsername: string;
    confirmationSlug: string;
    expectedPasswordHash: string;
    formerOwnerRole: "admin" | "member";
    expectedUpdatedAt: Date;
    memberId: string;
    auditId: string;
  }) {
    if (!input.currentToken) throw new UnauthorizedError();
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
      // Organization -> stable memberships -> stable current actors -> initiating
      // session. Recheck after these waits; preserve every existing permission.
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
      const target = await lockTransferActors(
        tx,
        input.actorId,
        input.targetId,
        input.targetUsername,
        input.expectedPasswordHash,
      );
      await lockInitiatingSession(tx, input.actorId, input.currentToken);
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
  history(id: string, actorId: string, before?: string): Promise<HistoryPage>;
  history(
    id: string,
    actorId: string,
    before: string | undefined,
    filters: ChangeHistoryFilters<OrganizationChangeGroup>,
  ): Promise<FilteredHistoryPage>;
  async history(
    id: string,
    actorId: string,
    before?: string,
    filters?: ChangeHistoryFilters<OrganizationChangeGroup>,
  ): Promise<HistoryPage | FilteredHistoryPage> {
    const context = filters
      ? changeHistoryContext(
          "organization-change-history",
          actorId,
          id,
          ORGANIZATION_CHANGE_GROUPS,
          filters,
        )
      : undefined;
    if (filters && before !== filters.before)
      throw new AppError("History cursor changed", 400, "INVALID_CURSOR");
    if (before && !/^[a-zA-Z0-9_-]{1,128}$/u.test(before))
      throw new AppError("Invalid history cursor", 400, "VALIDATION_ERROR");
    return db.transaction(
      async (tx) => {
        const { organization, role } = await organizationWorkspaceAccess(tx, id, actorId);
        if (!canManageOrganization(role))
          throw new AppError("History is private", 403, "FORBIDDEN");
        const until = filters ? await changeHistoryWindow(tx, filters) : undefined;
        const group = filters?.group ?? "all";
        const selectedActions =
          group === "profile"
            ? ["organization.created", "organization.profile_updated"]
            : group === "team"
              ? [
                  "organization.member_added",
                  "organization.member_updated",
                  "organization.member_removed",
                  "organization.member_left",
                ]
              : group === "ownership"
                ? ["organization.ownership_transferred"]
                : [...actions];
        const subject = alias(users, "organization_activity_subject");
        const selectedSubject = sql`case when ${auditEvents.action} = 'organization.ownership_transferred' then ${auditEvents.details}->>'newOwnerId' else ${auditEvents.details}->>'userId' end`;
        const pattern = filters?.query ? containsPattern(filters.query) : undefined;
        const scope = and(
          eq(auditEvents.targetType, "organization"),
          eq(auditEvents.targetId, id),
          inArray(auditEvents.action, selectedActions),
          filters && until
            ? changeHistoryBounds(auditEvents.createdAt, filters.period, until)
            : undefined,
          pattern
            ? sql`(${users.username} ilike ${pattern} or ${users.displayName} ilike ${pattern} or ${subject.username} ilike ${pattern} or ${subject.displayName} ilike ${pattern})`
            : undefined,
        );
        let older: SQL | undefined;
        const anchorId = filters?.cursor?.id ?? before;
        if (anchorId) {
          const [anchor] = await tx
            .select({
              id: auditEvents.id,
              time: sql<string>`to_char(${auditEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
            })
            .from(auditEvents)
            .leftJoin(users, eq(users.id, auditEvents.actorId))
            .leftJoin(subject, eq(subject.id, selectedSubject))
            .where(and(scope, eq(auditEvents.id, anchorId)))
            .limit(1);
          if (!anchor)
            throw new AppError("History page expired", 404, "ORGANIZATION_HISTORY_EXPIRED");
          older = sql`(${auditEvents.createdAt}, ${auditEvents.id}) < (${anchor.time}::timestamptz, ${anchor.id})`;
        }
        // Never return raw details, contact/account fields, network metadata, proof,
        // or permission arrays. Legacy details are type/allowlist checked in SQL.
        const rows = await tx
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            createdAt: sql<string>`to_char(${auditEvents.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
            actorUsername: sql<string | null>`left(${users.username},128)`,
            actorName: sql<string | null>`left(${users.displayName},128)`,
            subjectUsername: sql<string | null>`left(${subject.username},128)`,
            subjectName: sql<string | null>`left(${subject.displayName},128)`,
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
        const last = items.at(-1);
        const page = {
          organization: { id: organization.id, name: organization.name, slug: organization.slug },
          items,
          hasMore: rows.length > 20,
        };
        if (filters && context && until)
          return {
            ...page,
            nextCursor:
              page.hasMore && last ? { version: 1 as const, context, until, id: last.id } : null,
            until,
            period: filters.period,
            group: filters.group,
            query: filters.query,
          };
        return { ...page, nextCursor: page.hasMore && last ? last.id : null };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
export const organizationGovernanceRepository = new OrganizationGovernanceRepository();
