import {
  AppError,
  ForbiddenError,
  NotFoundError,
  STORAGE_ORPHAN_GRACE_DAYS,
  UnauthorizedError,
  type StorageMaintenanceState,
  type StorageObjectIdentity,
} from "@nexus/domain";
import { generateId } from "@nexus/security";
import { and, asc, count, eq, gt, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, sessions, storageMaintenanceObjects as objects, users } from "../schema";
import { historyPageBounds } from "./history-pagination";
import { digestSessionToken } from "./sessions";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function admin(tx: Tx, actorId: string) {
  const [actor] = await tx
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, actorId))
    .for("share")
    .limit(1);
  if (actor?.role !== "admin") throw new ForbiddenError();
}
// User share lock first, then the initiating session, matching revocation order.
async function lockInitiatingSession(tx: Tx, actorId: string, token: string) {
  const [current] = await tx
    .select({ id: sessions.id, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, actorId),
        eq(sessions.token, digestSessionToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .for("update");
  const expiresAt = current ? new Date(current.expiresAt).getTime() : Number.NaN;
  if (!current || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new UnauthorizedError("Authentication required");
  }
}
function references() {
  // Fully qualify both sides: drizzle strips table prefixes in nested exists,
  // so ${builds.storageKey} = ${objects.storageKey} becomes "storage_key" = "storage_key"
  // and any builds/media/assets row marks every object referenced.
  return sql<boolean>`(exists(select 1 from builds where builds.storage_key = storage_maintenance_objects.storage_key) OR
    exists(select 1 from resource_media where resource_media.storage_key = storage_maintenance_objects.storage_key) OR
    exists(select 1 from assets where assets.storage_key = storage_maintenance_objects.storage_key))`;
}
function eligible() {
  return sql<boolean>`${objects.retiredAt} is null AND ${objects.modifiedAt} <= clock_timestamp() - ${STORAGE_ORPHAN_GRACE_DAYS} * interval '1 day' AND NOT ${references()}`;
}
const fields = {
  id: objects.id,
  storageKey: objects.storageKey,
  identity: objects.identity,
  modifiedAt: objects.modifiedAt,
  state: objects.state,
  revision: objects.revision,
  observedAt: objects.observedAt,
  updatedAt: objects.updatedAt,
  retiredAt: objects.retiredAt,
  leaseExpiresAt: objects.leaseExpiresAt,
  resultCode: objects.resultCode,
  referenced: references(),
  eligible: eligible(),
};
export type StorageMaintenanceView = "all" | "eligible" | "referenced" | StorageMaintenanceState;
export class StorageMaintenanceRepository {
  assertAdmin(actorId: string) {
    return db.transaction((tx) => admin(tx, actorId));
  }
  async list(actorId: string, page = 1, view: StorageMaintenanceView = "all") {
    return db.transaction(async (tx) => {
      await admin(tx, actorId);
      const where =
        view === "all"
          ? undefined
          : view === "eligible"
            ? eligible()
            : view === "referenced"
              ? references()
              : eq(objects.state, view);
      const [total] = await tx.select({ total: count() }).from(objects).where(where);
      const bounds = historyPageBounds(total?.total ?? 0, page);
      const items = await tx
        .select(fields)
        .from(objects)
        .where(where)
        .orderBy(asc(objects.modifiedAt), asc(objects.id))
        .limit(bounds.pageSize)
        .offset(bounds.offset);
      const [summary] = await tx
        .select({
          deletedBytes: sql<string>`coalesce(sum((${objects.identity}->>'sizeBytes')::bigint) filter (where ${objects.state} = 'deleted'),0)::text`,
        })
        .from(objects);
      return { items, deletedBytes: summary?.deletedBytes ?? "0", ...bounds };
    });
  }
  async detail(actorId: string, id: string) {
    return db.transaction(async (tx) => {
      await admin(tx, actorId);
      const [item] = await tx.select(fields).from(objects).where(eq(objects.id, id)).limit(1);
      if (!item) throw new NotFoundError("Storage object");
      return item;
    });
  }
  async observe(actorId: string, currentToken: string, identities: StorageObjectIdentity[]) {
    return db.transaction(async (tx) => {
      await admin(tx, actorId);
      await lockInitiatingSession(tx, actorId, currentToken);
      for (const identity of [...identities].sort((a, b) => a.key.localeCompare(b.key))) {
        await tx
          .insert(objects)
          .values({
            id: generateId("smo"),
            storageKey: identity.key,
            identity,
            modifiedAt: new Date(identity.modifiedAt),
          })
          .onConflictDoUpdate({
            target: objects.storageKey,
            set: {
              identity,
              modifiedAt: new Date(identity.modifiedAt),
              observedAt: sql`clock_timestamp()`,
              updatedAt: sql`clock_timestamp()`,
              revision: sql`case when ${objects.identity} = ${JSON.stringify(identity)}::jsonb then ${objects.revision} else ${objects.revision} + 1 end`,
            },
            setWhere: sql`${objects.retiredAt} is null`,
          });
      }
      await tx.insert(auditEvents).values({
        id: generateId("aud"),
        actorId,
        actorType: "user",
        action: "storage.discovered",
        targetType: "storage",
        targetId: "inventory",
        details: { observed: identities.length },
      });
      return { observed: identities.length };
    });
  }
  async retire(actorId: string, currentToken: string, id: string, expectedRevision: number) {
    return db.transaction(
      async (tx) => {
        await tx.execute(sql`set local lock_timeout = '5s'`);
        await tx.execute(sql`set local statement_timeout = '10s'`);
        await admin(tx, actorId);
        await lockInitiatingSession(tx, actorId, currentToken);
        const [item] = await tx
          .select()
          .from(objects)
          .where(eq(objects.id, id))
          .for("update")
          .limit(1);
        if (!item) throw new NotFoundError("Storage object");
        if (["deleted", "missing", "changed"].includes(item.state))
          return { terminal: true as const, state: item.state };
        if (item.revision !== expectedRevision)
          throw new AppError("Refresh the object", 409, "STORAGE_REVISION_CONFLICT");
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended('storage-retirement:' || ${item.storageKey},0))`,
        );
        const [check] = await tx
          .select({
            referenced: references(),
            old: sql<boolean>`${objects.modifiedAt} <= clock_timestamp() - ${STORAGE_ORPHAN_GRACE_DAYS} * interval '1 day'`,
            busy: sql<boolean>`${objects.leaseExpiresAt} > clock_timestamp()`,
          })
          .from(objects)
          .where(eq(objects.id, id));
        if (check.referenced)
          throw new AppError("Referenced storage object", 409, "STORAGE_REFERENCED");
        if (!check.old) throw new AppError("Storage object is recent", 409, "STORAGE_RECENT");
        if (check.busy) throw new AppError("Cleanup is in progress", 409, "STORAGE_BUSY");
        const leaseToken = generateId("sml");
        await tx
          .update(objects)
          .set({
            state: "retired",
            retiredAt: item.retiredAt ?? sql`clock_timestamp()`,
            leaseToken,
            leaseExpiresAt: sql`clock_timestamp() + interval '2 minutes'`,
            requestedBy: actorId,
            resultCode: null,
            revision: item.revision + 1,
            updatedAt: sql`clock_timestamp()`,
          })
          .where(eq(objects.id, id));
        await tx.insert(auditEvents).values({
          id: generateId("aud"),
          actorId,
          actorType: "user",
          action: "storage.retired",
          targetType: "storage_object",
          targetId: id,
          details: { retry: item.retiredAt !== null, revision: item.revision + 1 },
        });
        return { terminal: false as const, leaseToken, identity: item.identity };
      },
      { isolationLevel: "read committed" },
    );
  }
  /** Internal completion: persist even if the operator loses their role after retirement. */
  async finish(
    actorId: string,
    id: string,
    leaseToken: string,
    state: Exclude<StorageMaintenanceState, "observed" | "retired">,
  ) {
    return db.transaction(async (tx) => {
      const [item] = await tx
        .update(objects)
        .set({
          state,
          leaseToken: null,
          leaseExpiresAt: null,
          resultCode: state === "failed" ? "STORAGE_REMOVAL_FAILED" : null,
          revision: sql`${objects.revision} + 1`,
          updatedAt: sql`clock_timestamp()`,
        })
        .where(
          and(eq(objects.id, id), eq(objects.leaseToken, leaseToken), eq(objects.state, "retired")),
        )
        .returning({ state: objects.state });
      if (!item)
        throw new AppError("Cleanup outcome must be refreshed", 409, "STORAGE_OUTCOME_UNKNOWN");
      await tx.insert(auditEvents).values({
        id: generateId("aud"),
        actorId,
        actorType: "user",
        action: `storage.${state}`,
        targetType: "storage_object",
        targetId: id,
        details: { state },
      });
      return item;
    });
  }
}
export const storageMaintenanceRepository = new StorageMaintenanceRepository();
