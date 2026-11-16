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
  UnauthorizedError,
  LICENSE_RUNTIME_TOKEN_DAYS,
  LICENSE_RUNTIME_LEASE_SECONDS,
  canModerateLicense,
} from "@nexus/domain";
import type {
  LicenseOwnerCommand,
  LicenseModerationCommand,
  LicenseReleaseCheck,
} from "@nexus/domain";
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
import { trustedCleanScanCondition, safePublishedBuildCondition } from "./build-safety";
import { historyPageBounds } from "./history-pagination";
import { managedServerScope } from "./server-management-scope";
import { assertOrganizationServerClaimAuthority } from "./server-claim-authority";
import { assertBuildModerationAuthority } from "./product-mutation-authority";
import { containsPattern } from "./search-pattern";
import type { ResourceTransaction } from "../transaction";
import { lockInitiatingSession } from "./initiating-session";

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
  bindingOwnerId: bindings.serverOwnerId,
  tokenExpiresAt: bindings.tokenExpiresAt,
  tokenActive: sql<boolean>`${bindings.tokenDigest} IS NOT NULL AND ${bindings.tokenExpiresAt} > clock_timestamp()`,
};

function usableBinding(userId: string) {
  return and(
    eq(licenses.userId, userId),
    eq(licenses.serverId, bindings.serverId),
    eq(licenses.status, "active"),
    eq(licenses.model, "single_server"),
    gt(licenses.expiresAt, sql`clock_timestamp()`),
    eq(servers.endpointRevision, bindings.endpointRevision),
    eq(servers.ownerId, bindings.serverOwnerId),
    eq(servers.status, "active"),
    eq(servers.isVerified, true),
    sql`${servers.organizationId} IS NOT DISTINCT FROM ${bindings.organizationId}`,
    managedServerScope(userId),
    confirmedControlProof(),
    availableProduct(),
  );
}

function visibleLicense(licenseId: string, actorId: string, moderation: boolean) {
  return and(
    eq(licenses.id, licenseId),
    moderation
      ? exists(
          db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.id, actorId), inArray(users.role, ["admin", "moderator"]))),
        )
      : eq(licenses.userId, actorId),
  );
}

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
  async historyPage(licenseId: string, actorId: string, moderation = false, requestedPage = 1) {
    return db.transaction(
      async (tx) => {
        const [license] = await tx
          .select({ id: licenses.id, productTitle: products.title })
          .from(licenses)
          .innerJoin(products, eq(products.id, licenses.productId))
          .where(visibleLicense(licenseId, actorId, moderation))
          .limit(1);
        if (!license) throw new NotFoundError("License", licenseId);
        const scope = and(
          eq(auditEvents.targetType, "license"),
          eq(auditEvents.targetId, licenseId),
        );
        const [summary] = await tx.select({ total: count() }).from(auditEvents).where(scope);
        const bounds = historyPageBounds(summary?.total ?? 0, requestedPage);
        const items = await tx
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            actorType: auditEvents.actorType,
            reason: sql<string | null>`left(${auditEvents.details}->>'reason', 1000)`,
            fromEndpointRevision: sql<
              number | null
            >`case when jsonb_typeof(${auditEvents.details}->'fromEndpointRevision') = 'number'
          then (${auditEvents.details}->>'fromEndpointRevision')::numeric else null end`.mapWith(
              Number,
            ),
            toEndpointRevision: sql<
              number | null
            >`case when jsonb_typeof(${auditEvents.details}->'toEndpointRevision') = 'number'
          then (${auditEvents.details}->>'toEndpointRevision')::numeric else null end`.mapWith(
              Number,
            ),
            createdAt: auditEvents.createdAt,
          })
          .from(auditEvents)
          .where(scope)
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { license, items, ...bounds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async releasePage(licenseId: string, actorId: string, requestedPage = 1) {
    return db.transaction(
      async (tx) => {
        const [context] = await tx
          .select({
            licenseId: licenses.id,
            productId: licenses.productId,
            serverId: bindings.serverId,
          })
          .from(licenses)
          .innerJoin(bindings, eq(bindings.licenseId, licenses.id))
          .innerJoin(products, eq(products.id, licenses.productId))
          .innerJoin(servers, eq(servers.id, bindings.serverId))
          .where(and(eq(licenses.id, licenseId), usableBinding(actorId)))
          .limit(1);
        if (!context) throw new NotFoundError("License runtime context", licenseId);
        const scope = and(
          safePublishedBuildCondition(context.productId),
          sql`${builds.sha256Hash} ~ '^[a-f0-9]{64}$'`,
          gt(builds.fileSizeBytes, 0),
        );
        const [summary] = await tx.select({ total: count() }).from(builds).where(scope);
        const bounds = historyPageBounds(summary?.total ?? 0, requestedPage);
        const items = await tx
          .select({ id: builds.id, version: builds.version, sha256Hash: builds.sha256Hash })
          .from(builds)
          .where(scope)
          .orderBy(desc(builds.createdAt), desc(builds.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { ...context, items, ...bounds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  /** Release-specific credential check; does not attest the caller or its files. */
  async verifyRelease(tokenDigest: string, command: LicenseReleaseCheck) {
    const [subject] = await db
      .select({ userId: licenses.userId })
      .from(bindings)
      .innerJoin(licenses, eq(licenses.id, bindings.licenseId))
      .where(eq(bindings.tokenDigest, tokenDigest))
      .limit(1);
    if (!subject) return null;
    const [row] = await db
      .select({
        licenseId: licenses.id,
        productId: licenses.productId,
        serverId: bindings.serverId,
        buildId: builds.id,
        version: builds.version,
        sha256Hash: builds.sha256Hash,
        expiresAt: sql<string>`least(${licenses.expiresAt}, ${bindings.tokenExpiresAt})::text`,
        checkedAt: sql<string>`clock_timestamp()::text`,
      })
      .from(bindings)
      .innerJoin(licenses, eq(licenses.id, bindings.licenseId))
      .innerJoin(products, eq(products.id, licenses.productId))
      .innerJoin(servers, eq(servers.id, bindings.serverId))
      .innerJoin(builds, eq(builds.productId, products.id))
      .where(
        and(
          eq(bindings.tokenDigest, tokenDigest),
          eq(bindings.serverId, command.serverId),
          eq(products.id, command.productId),
          eq(builds.id, command.buildId),
          eq(builds.sha256Hash, command.sha256Hash),
          gt(bindings.tokenExpiresAt, sql`clock_timestamp()`),
          usableBinding(subject.userId),
          safePublishedBuildCondition(command.productId),
          gt(builds.fileSizeBytes, 0),
        ),
      )
      .limit(1);
    if (!row) return null;
    const checked = Date.parse(row.checkedAt),
      expires = Date.parse(row.expiresAt);
    if (!Number.isFinite(checked) || !Number.isFinite(expires) || expires <= checked) return null;
    return {
      valid: true as const,
      ...row,
      nonce: command.nonce,
      checkedAt: new Date(checked).toISOString(),
      expiresAt: new Date(expires).toISOString(),
      leaseExpiresAt: new Date(
        Math.min(expires, checked + LICENSE_RUNTIME_LEASE_SECONDS * 1000),
      ).toISOString(),
      recheckAfterSeconds: Math.min(30, Math.max(1, Math.floor((expires - checked) / 1000))),
    };
  }
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
                ownerId: servers.ownerId,
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
            reason: sql<string | null>`left(${auditEvents.details}->>'reason', 1000)`,
            createdAt: auditEvents.createdAt,
          })
          .from(auditEvents)
          .where(and(eq(auditEvents.targetType, "license"), eq(auditEvents.targetId, license.id)))
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(20);
        const now = await clock(tx);
        const active =
          license.status === "active" && !!license.expiresAt && license.expiresAt > now;
        const { bindingOwnerId, ...presentation } = license;
        return {
          ...presentation,
          effectiveStatus:
            license.status === "active" && license.expiresAt && license.expiresAt <= now
              ? "expired"
              : license.status,
          canActivate: active && license.model === "single_server" && license.productAvailable,
          bindingReady:
            !!server &&
            server.eligible &&
            server.revision === license.endpointRevision &&
            !!bindingOwnerId &&
            server.ownerId === bindingOwnerId,
          canRefreshBinding:
            active &&
            license.model === "single_server" &&
            license.productAvailable &&
            !!server &&
            server.eligible &&
            (!bindingOwnerId || server.ownerId === bindingOwnerId) &&
            (!bindingOwnerId || server.revision !== license.endpointRevision),
          currentEndpointRevision: server?.revision ?? null,
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
    currentToken: string;
    command: LicenseOwnerCommand;
    auditId: string;
    tokenDigest?: string;
  }) {
    if (!input.currentToken) throw new UnauthorizedError("Authentication required");
    return db.transaction(async (tx) => {
      const activating = ["bind", "refresh_binding", "rotate_token"].includes(input.command.action);
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
      // Access rows precede the current actor and initiating session, matching
      // the direct and multi-resource acquisition paths.
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.actorId))
        .for("share")
        .limit(1);
      if (!actor) throw new UnauthorizedError("Authentication required");
      await lockInitiatingSession(tx, input.actorId, input.currentToken);
      const now = await clock(tx);
      let tokenExpiresAt: Date | undefined;
      let serverId = license.serverId;
      let status = license.status;
      let refreshedEndpointRevision: number | undefined;
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
            ownerId: servers.ownerId,
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
          (binding.organizationId !== server.organizationId ||
            (binding.serverOwnerId && binding.serverOwnerId !== server.ownerId) ||
            (input.command.action !== "refresh_binding" &&
              (binding.endpointRevision !== server.revision || !binding.serverOwnerId)))
        )
          throw fail("LICENSE_SERVER_CHANGED");
        if (input.command.action === "bind") {
          if (binding) throw fail("LICENSE_ALREADY_BOUND");
          await tx.insert(bindings).values({
            licenseId: license.id,
            serverId: target,
            organizationId: server.organizationId,
            endpointRevision: server.revision,
            serverOwnerId: server.ownerId,
            createdAt: now,
            updatedAt: now,
          });
          serverId = target;
        } else if (input.command.action === "refresh_binding") {
          if (!binding) throw fail("LICENSE_NOT_BOUND");
          if (server.revision !== input.command.expectedEndpointRevision)
            throw fail("LICENSE_SERVER_CHANGED");
          if (binding.serverOwnerId && binding.endpointRevision === server.revision)
            throw fail("LICENSE_BINDING_CURRENT");
          refreshedEndpointRevision = server.revision;
          await tx
            .update(bindings)
            .set({
              endpointRevision: server.revision,
              serverOwnerId: server.ownerId,
              tokenDigest: null,
              tokenIssuedAt: null,
              tokenExpiresAt: null,
              updatedAt: now,
            })
            .where(eq(bindings.licenseId, license.id));
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
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.actorId,
        actorType: "user",
        action: `license.${input.command.action === "bind" ? "bound" : input.command.action === "refresh_binding" ? "binding_refreshed" : input.command.action === "rotate_token" ? "token_rotated" : input.command.action === "revoke_token" ? "token_revoked" : "revoked"}`,
        targetId: license.id,
        targetType: "license",
        details: {
          reason: input.command.reason,
          previousStatus: license.status,
          status,
          termChanged: false,
          ...(input.command.action === "refresh_binding"
            ? {
                fromEndpointRevision: binding?.endpointRevision,
                toEndpointRevision: refreshedEndpointRevision,
                tokenRevoked: true,
              }
            : {}),
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
        ...(refreshedEndpointRevision !== undefined
          ? {
              binding: { endpointRevision: refreshedEndpointRevision, tokenRevoked: true as const },
            }
          : {}),
      };
    });
  }

  async moderate(input: {
    licenseId: string;
    actorId: string;
    currentToken: string;
    command: LicenseModerationCommand;
    auditId: string;
  }) {
    if (!input.currentToken) throw new UnauthorizedError("Authentication required");
    return db.transaction(async (tx) => {
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
      await tx
        .select({ licenseId: bindings.licenseId })
        .from(bindings)
        .where(eq(bindings.licenseId, license.id))
        .for("update");
      await assertBuildModerationAuthority(tx, input.actorId);
      await lockInitiatingSession(tx, input.actorId, input.currentToken);
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
      await tx.insert(auditEvents).values({
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
          gt(bindings.tokenExpiresAt, sql`clock_timestamp()`),
          usableBinding(subject.userId),
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
