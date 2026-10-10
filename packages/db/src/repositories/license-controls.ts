import {
  and,
  count,
  desc,
  eq,
  exists,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import {
  AppError,
  NotFoundError,
  LICENSE_RUNTIME_TOKEN_DAYS,
  canModerateLicense,
} from "@nexus/domain";
import type { LicenseOwnerCommand, LicenseModerationCommand } from "@nexus/domain";
import { db } from "../client";
import {
  auditEvents,
  builds,
  licenseRuntimeBindings as bindings,
  licenses,
  products,
  serverClaimChallenges,
  servers,
  users,
  verificationRequests,
} from "../schema";
import { trustedCleanScanCondition } from "./build-safety";
import { historyPageBounds } from "./history-pagination";
import { managedServerScope } from "./server-management-scope";
import { assertOrganizationServerClaimAuthority } from "./server-claim-authority";
import { assertBuildModerationAuthority } from "./product-mutation-authority";
import { containsPattern } from "./search-pattern";
import type { ResourceTransaction } from "./entitlements";

const fail = (code: string) =>
  new AppError("License operation is not currently permitted", 409, code);
const revision = sql<Date>`greatest(date_trunc('milliseconds', clock_timestamp()), ${licenses.updatedAt} + interval '1 millisecond')`;

/** An administrative trust badge alone is not a server-control proof. */
function confirmedControlProof() {
  return exists(
    db
      .select({ id: serverClaimChallenges.id })
      .from(serverClaimChallenges)
      .innerJoin(
        verificationRequests,
        eq(verificationRequests.id, serverClaimChallenges.verificationRequestId),
      )
      .where(
        and(
          eq(serverClaimChallenges.serverId, servers.id),
          eq(serverClaimChallenges.endpointRevision, servers.endpointRevision),
          eq(serverClaimChallenges.claimScopeRecorded, true),
          sql`${serverClaimChallenges.claimOrganizationId} IS NOT DISTINCT FROM ${servers.organizationId}`,
          or(
            isNotNull(servers.organizationId),
            eq(serverClaimChallenges.requesterId, servers.ownerId),
          ),
          isNotNull(serverClaimChallenges.consumedAt),
          isNotNull(serverClaimChallenges.sourceFetchedAt),
          isNull(serverClaimChallenges.revokedAt),
          eq(verificationRequests.targetType, "server"),
          eq(verificationRequests.targetId, servers.id),
          eq(verificationRequests.requesterId, serverClaimChallenges.requesterId),
          eq(verificationRequests.status, "approved"),
        ),
      ),
  );
}

function availableProduct() {
  return and(
    eq(products.status, "published"),
    exists(
      db
        .select({ id: builds.id })
        .from(builds)
        .where(
          and(
            eq(builds.productId, licenses.productId),
            eq(builds.status, "published"),
            trustedCleanScanCondition(),
          ),
        ),
    ),
  );
}

const detailFields = {
  id: licenses.id,
  productId: licenses.productId,
  productTitle: products.title,
  model: licenses.model,
  status: licenses.status,
  expiresAt: licenses.expiresAt,
  createdAt: licenses.createdAt,
  updatedAt: licenses.updatedAt,
  productAvailable: sql<boolean>`coalesce((${availableProduct()}), false)`,
  legacyServerBound: sql<boolean>`${licenses.serverId} IS NOT NULL`,
  boundServerId: bindings.serverId,
  endpointRevision: bindings.endpointRevision,
  tokenExpiresAt: bindings.tokenExpiresAt,
  tokenActive: sql<boolean>`${bindings.tokenDigest} IS NOT NULL AND ${bindings.tokenExpiresAt} > clock_timestamp()`,
};

async function clock(tx: ResourceTransaction) {
  const [row] = await tx.execute(sql`select clock_timestamp()::text as now`);
  return new Date(String(row.now));
}

function assertActiveTerm(license: { status: string; expiresAt: Date | null }, now: Date) {
  if (license.status !== "active") throw fail("LICENSE_INACTIVE");
  if (!license.expiresAt || !Number.isFinite(license.expiresAt.getTime()))
    throw fail("LICENSE_FINITE_TERM_REQUIRED");
  if (license.expiresAt.getTime() <= now.getTime()) throw fail("LICENSE_EXPIRED");
  return license.expiresAt;
}

async function clearToken(tx: ResourceTransaction, licenseId: string, updatedAt: Date) {
  const rows = await tx
    .update(bindings)
    .set({ tokenDigest: null, tokenIssuedAt: null, tokenExpiresAt: null, updatedAt })
    .where(eq(bindings.licenseId, licenseId))
    .returning({ serverId: bindings.serverId });
  return rows[0] ?? null;
}

export class LicenseControlsRepository {
  async detail(licenseId: string, actorId: string, moderation = false) {
    return db.transaction(
      async (tx) => {
        const scope = moderation
          ? exists(
              tx
                .select({ id: users.id })
                .from(users)
                .where(and(eq(users.id, actorId), inArray(users.role, ["admin", "moderator"]))),
            )
          : eq(licenses.userId, actorId);
        const [license] = await tx
          .select(detailFields)
          .from(licenses)
          .innerJoin(products, eq(products.id, licenses.productId))
          .leftJoin(bindings, eq(bindings.licenseId, licenses.id))
          .where(and(eq(licenses.id, licenseId), scope))
          .limit(1);
        if (!license) return null;
        // Server metadata is disclosed only under the viewer's current server grants.
        const [server] = license.boundServerId
          ? await tx
              .select({
                name: servers.name,
                revision: servers.endpointRevision,
                eligible: sql<boolean>`coalesce((${and(
                  eq(servers.status, "active"),
                  eq(servers.isVerified, true),
                  confirmedControlProof(),
                  sql`${servers.organizationId} IS NOT DISTINCT FROM ${bindings.organizationId}`,
                )}), false)`,
              })
              .from(servers)
              .innerJoin(
                bindings,
                and(eq(bindings.serverId, servers.id), eq(bindings.licenseId, license.id)),
              )
              .where(and(eq(servers.id, license.boundServerId), managedServerScope(actorId)))
              .limit(1)
          : [];
        const history = await tx
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            actorType: auditEvents.actorType,
            reason: sql<string | null>`${auditEvents.details}->>'reason'`,
            createdAt: auditEvents.createdAt,
          })
          .from(auditEvents)
          .where(and(eq(auditEvents.targetType, "license"), eq(auditEvents.targetId, license.id)))
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(20);
        const now = await clock(tx);
        const active =
          license.status === "active" && !!license.expiresAt && license.expiresAt > now;
        return {
          ...license,
          effectiveStatus:
            license.status === "active" && license.expiresAt && license.expiresAt <= now
              ? "expired"
              : license.status,
          canActivate: active && license.model === "single_server" && license.productAvailable,
          bindingReady: !!server && server.eligible && server.revision === license.endpointRevision,
          serverName: server?.name ?? null,
          history,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async eligibleServers(licenseId: string, actorId: string, requestedPage = 1) {
    return db.transaction(
      async (tx) => {
        const [license] = await tx
          .select({ serverId: licenses.serverId })
          .from(licenses)
          .where(and(eq(licenses.id, licenseId), eq(licenses.userId, actorId)))
          .limit(1);
        if (!license) throw new NotFoundError("License", licenseId);
        const [binding] = await tx
          .select({ serverId: bindings.serverId })
          .from(bindings)
          .where(eq(bindings.licenseId, licenseId))
          .limit(1);
        const bound = binding?.serverId ?? license.serverId;
        const scope = and(
          managedServerScope(actorId),
          eq(servers.status, "active"),
          eq(servers.isVerified, true),
          confirmedControlProof(),
          bound ? eq(servers.id, bound) : undefined,
        );
        const [summary] = await tx.select({ total: count() }).from(servers).where(scope);
        const bounds = historyPageBounds(summary?.total ?? 0, requestedPage);
        const items = await tx
          .select({ id: servers.id, name: servers.name })
          .from(servers)
          .where(scope)
          .orderBy(desc(servers.updatedAt), desc(servers.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { servers: items, ...bounds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async moderationPage(actorId: string, requestedPage = 1, status?: string, query = "") {
    return db.transaction(
      async (tx) => {
        const scope = and(
          exists(
            tx
              .select({ id: users.id })
              .from(users)
              .where(and(eq(users.id, actorId), inArray(users.role, ["admin", "moderator"]))),
          ),
          status && ["active", "expired", "suspended", "revoked"].includes(status)
            ? status === "expired"
              ? or(
                  eq(licenses.status, "expired"),
                  and(
                    eq(licenses.status, "active"),
                    sql`${licenses.expiresAt} <= clock_timestamp()`,
                  ),
                )
              : and(
                  eq(licenses.status, status),
                  status === "active"
                    ? or(isNull(licenses.expiresAt), gt(licenses.expiresAt, sql`clock_timestamp()`))
                    : undefined,
                )
            : undefined,
          query
            ? or(
                ilike(licenses.id, containsPattern(query.slice(0, 120))),
                ilike(products.title, containsPattern(query.slice(0, 120))),
              )
            : undefined,
        );
        const [summary] = await tx
          .select({ total: count() })
          .from(licenses)
          .innerJoin(products, eq(products.id, licenses.productId))
          .where(scope);
        const bounds = historyPageBounds(summary?.total ?? 0, requestedPage);
        const items = await tx
          .select({
            id: licenses.id,
            productTitle: products.title,
            status: licenses.status,
            expiresAt: licenses.expiresAt,
            updatedAt: licenses.updatedAt,
          })
          .from(licenses)
          .innerJoin(products, eq(products.id, licenses.productId))
          .where(scope)
          .orderBy(desc(licenses.updatedAt), desc(licenses.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { licenses: items, ...bounds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async ownerCommand(input: {
    licenseId: string;
    actorId: string;
    command: LicenseOwnerCommand;
    auditId: string;
    tokenDigest?: string;
  }) {
    return db.transaction(async (tx) => {
      const activating = input.command.action === "bind" || input.command.action === "rotate_token";
      if (activating) {
        const [preflight] = await tx
          .select({
            productId: licenses.productId,
            serverId: licenses.serverId,
            boundId: bindings.serverId,
          })
          .from(licenses)
          .leftJoin(bindings, eq(bindings.licenseId, licenses.id))
          .where(and(eq(licenses.id, input.licenseId), eq(licenses.userId, input.actorId)))
          .limit(1);
        if (!preflight) throw new NotFoundError("License", input.licenseId);
        // Product -> server -> grants -> license -> binding. Parent locks also
        // serialize moderation and endpoint changes with token issuance.
        await tx
          .select({ id: products.id })
          .from(products)
          .where(eq(products.id, preflight.productId))
          .for("share");
        const target = input.command.action === "bind" ? input.command.serverId : preflight.boundId;
        if (!target) throw fail("LICENSE_NOT_BOUND");
        const [server] = await tx
          .select({ id: servers.id, organizationId: servers.organizationId })
          .from(servers)
          .where(and(eq(servers.id, target), managedServerScope(input.actorId)))
          .for("share")
          .limit(1);
        if (!server) throw fail("LICENSE_SERVER_UNAVAILABLE");
        if (server.organizationId)
          await assertOrganizationServerClaimAuthority(tx, server.organizationId, input.actorId);
        const [currentScope] = await tx
          .select({ id: servers.id })
          .from(servers)
          .where(and(eq(servers.id, target), managedServerScope(input.actorId)))
          .limit(1);
        if (!currentScope) throw fail("LICENSE_SERVER_UNAVAILABLE");
      }
      const [license] = await tx
        .select({
          id: licenses.id,
          productId: licenses.productId,
          serverId: licenses.serverId,
          model: licenses.model,
          status: licenses.status,
          expiresAt: licenses.expiresAt,
          updatedAt: licenses.updatedAt,
        })
        .from(licenses)
        .where(and(eq(licenses.id, input.licenseId), eq(licenses.userId, input.actorId)))
        .for("no key update")
        .limit(1);
      if (!license) throw new NotFoundError("License", input.licenseId);
      if (license.updatedAt.toISOString() !== input.command.expectedUpdatedAt)
        throw fail("LICENSE_CONFLICT");
      const [binding] = await tx
        .select()
        .from(bindings)
        .where(eq(bindings.licenseId, license.id))
        .for("update")
        .limit(1);
      const now = await clock(tx);
      let tokenExpiresAt: Date | undefined;
      let serverId = license.serverId;
      let status = license.status;
      if (activating) {
        const paidExpiry = assertActiveTerm(license, now);
        if (license.model !== "single_server") throw fail("LICENSE_SINGLE_SERVER_REQUIRED");
        const target = input.command.action === "bind" ? input.command.serverId : binding?.serverId;
        if (!target) throw fail("LICENSE_NOT_BOUND");
        if (
          (binding && binding.serverId !== target) ||
          (license.serverId && license.serverId !== target)
        )
          throw fail("LICENSE_ALREADY_BOUND");
        const [server] = await tx
          .select({
            id: servers.id,
            organizationId: servers.organizationId,
            revision: servers.endpointRevision,
          })
          .from(servers)
          .where(
            and(
              eq(servers.id, target),
              managedServerScope(input.actorId),
              eq(servers.status, "active"),
              eq(servers.isVerified, true),
              confirmedControlProof(),
            ),
          )
          .limit(1);
        const [available] = await tx
          .select({ id: licenses.id })
          .from(licenses)
          .innerJoin(products, eq(products.id, licenses.productId))
          .where(and(eq(licenses.id, license.id), availableProduct()))
          .limit(1);
        if (!server || !available) throw fail("LICENSE_SERVER_UNAVAILABLE");
        if (
          binding &&
          (binding.endpointRevision !== server.revision ||
            binding.organizationId !== server.organizationId)
        )
          throw fail("LICENSE_SERVER_CHANGED");
        if (input.command.action === "bind") {
          if (binding) throw fail("LICENSE_ALREADY_BOUND");
          await tx
            .insert(bindings)
            .values({
              licenseId: license.id,
              serverId: target,
              organizationId: server.organizationId,
              endpointRevision: server.revision,
              createdAt: now,
              updatedAt: now,
            });
          serverId = target;
        } else {
          if (!input.tokenDigest || !/^[a-f0-9]{64}$/u.test(input.tokenDigest))
            throw new Error("Missing token digest");
          tokenExpiresAt = new Date(
            Math.min(paidExpiry.getTime(), now.getTime() + LICENSE_RUNTIME_TOKEN_DAYS * 86_400_000),
          );
          await tx
            .update(bindings)
            .set({
              tokenDigest: input.tokenDigest,
              tokenIssuedAt: now,
              tokenExpiresAt,
              updatedAt: now,
            })
            .where(eq(bindings.licenseId, license.id));
        }
      } else if (input.command.action === "revoke") {
        if (!canModerateLicense(license.status, "revoke")) throw fail("LICENSE_INACTIVE");
        status = "revoked";
        await clearToken(tx, license.id, now);
      } else {
        await clearToken(tx, license.id, now);
      }
      const [updated] = await tx
        .update(licenses)
        .set({ status, serverId, updatedAt: revision })
        .where(eq(licenses.id, license.id))
        .returning({ id: licenses.id, status: licenses.status, updatedAt: licenses.updatedAt });
      await tx
        .insert(auditEvents)
        .values({
          id: input.auditId,
          actorId: input.actorId,
          actorType: "user",
          action: `license.${input.command.action === "bind" ? "bound" : input.command.action === "rotate_token" ? "token_rotated" : input.command.action === "revoke_token" ? "token_revoked" : "revoked"}`,
          targetId: license.id,
          targetType: "license",
          details: {
            reason: input.command.reason,
            previousStatus: license.status,
            status,
            termChanged: false,
          },
          createdAt: now,
        });
      return {
        license: {
          ...updated,
          updatedAt: updated.updatedAt.toISOString(),
          serverBound: !!(binding || serverId),
        },
        tokenExpiresAt,
      };
    });
  }

  async moderate(input: {
    licenseId: string;
    actorId: string;
    command: LicenseModerationCommand;
    auditId: string;
  }) {
    return db.transaction(async (tx) => {
      await assertBuildModerationAuthority(tx, input.actorId);
      const [license] = await tx
        .select({
          id: licenses.id,
          status: licenses.status,
          expiresAt: licenses.expiresAt,
          updatedAt: licenses.updatedAt,
          serverId: licenses.serverId,
        })
        .from(licenses)
        .where(eq(licenses.id, input.licenseId))
        .for("no key update")
        .limit(1);
      if (!license) throw new NotFoundError("License", input.licenseId);
      if (license.updatedAt.toISOString() !== input.command.expectedUpdatedAt)
        throw fail("LICENSE_CONFLICT");
      if (!canModerateLicense(license.status, input.command.action)) throw fail("LICENSE_INACTIVE");
      const now = await clock(tx);
      if (input.command.action !== "revoke")
        assertActiveTerm({ ...license, status: "active" }, now);
      const status =
        input.command.action === "restore"
          ? "active"
          : input.command.action === "suspend"
            ? "suspended"
            : "revoked";
      const binding = await clearToken(tx, license.id, now); // Restoring never resurrects a credential.
      const [updated] = await tx
        .update(licenses)
        .set({ status, updatedAt: revision })
        .where(eq(licenses.id, license.id))
        .returning({ id: licenses.id, status: licenses.status, updatedAt: licenses.updatedAt });
      await tx
        .insert(auditEvents)
        .values({
          id: input.auditId,
          actorId: input.actorId,
          actorType: "admin",
          action: `license.${input.command.action === "restore" ? "restored" : input.command.action === "suspend" ? "suspended" : "revoked"}`,
          targetId: license.id,
          targetType: "license",
          details: {
            reason: input.command.reason,
            previousStatus: license.status,
            status,
            termChanged: false,
          },
          createdAt: now,
        });
      return {
        license: {
          ...updated,
          updatedAt: updated.updatedAt.toISOString(),
          serverBound: !!(binding || license.serverId),
        },
      };
    });
  }

  /** The token only checks a saved license binding; it grants no file access. */
  async verify(tokenDigest: string, serverId: string) {
    const [subject] = await db
      .select({ userId: licenses.userId })
      .from(bindings)
      .innerJoin(licenses, eq(licenses.id, bindings.licenseId))
      .where(eq(bindings.tokenDigest, tokenDigest))
      .limit(1);
    if (!subject) return null;
    const [result] = await db
      .select({
        licenseId: licenses.id,
        productId: licenses.productId,
        serverId: bindings.serverId,
        expiresAt: sql<string>`least(${licenses.expiresAt}, ${bindings.tokenExpiresAt})::text`,
        checkedAt: sql<string>`clock_timestamp()::text`,
      })
      .from(bindings)
      .innerJoin(licenses, eq(licenses.id, bindings.licenseId))
      .innerJoin(products, eq(products.id, licenses.productId))
      .innerJoin(servers, eq(servers.id, bindings.serverId))
      .where(
        and(
          eq(bindings.tokenDigest, tokenDigest),
          eq(bindings.serverId, serverId),
          eq(licenses.serverId, bindings.serverId),
          eq(licenses.userId, subject.userId),
          eq(licenses.status, "active"),
          eq(licenses.model, "single_server"),
          gt(licenses.expiresAt, sql`clock_timestamp()`),
          gt(bindings.tokenExpiresAt, sql`clock_timestamp()`),
          eq(servers.endpointRevision, bindings.endpointRevision),
          eq(servers.status, "active"),
          eq(servers.isVerified, true),
          sql`${servers.organizationId} IS NOT DISTINCT FROM ${bindings.organizationId}`,
          managedServerScope(subject.userId),
          confirmedControlProof(),
          availableProduct(),
        ),
      )
      .limit(1);
    if (!result || Date.parse(result.expiresAt) <= Date.parse(result.checkedAt)) return null;
    return {
      valid: true as const,
      ...result,
      expiresAt: new Date(result.expiresAt).toISOString(),
      checkedAt: new Date(result.checkedAt).toISOString(),
      recheckAfterSeconds: 60,
    };
  }
}

export const licenseControlsRepository = new LicenseControlsRepository();
