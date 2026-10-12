import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  AppError,
  NotFoundError,
  type ResourceReleaseWatchDisableCommand,
  type ResourceReleaseWatchDisableResult,
} from "@nexus/domain";
import { resourceReleaseWatchDisableCommandSchema } from "@nexus/validation";
import { db } from "../client";
import { auditEvents, resourceReleaseWatches as watches, users } from "../schema";
const fail = () => new AppError("Watch batch changed", 409, "RELEASE_WATCH_BATCH_CONFLICT");
const fields = {
  productId: watches.productId,
  enabled: watches.enabled,
  revision: watches.revision,
  updatedAt: watches.updatedAt,
};
export async function disableResourceReleaseWatchBatch(input: {
  userId: string;
  command: ResourceReleaseWatchDisableCommand;
  auditId: string;
}): Promise<ResourceReleaseWatchDisableResult> {
  const parsed = resourceReleaseWatchDisableCommandSchema.safeParse(input.command);
  if (!parsed.success) throw new AppError("Invalid watch batch", 400, "RELEASE_WATCH_INVALID");
  const command = parsed.data;
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout='5s'`);
    await tx.execute(sql`set local statement_timeout='10s'`);
    // Same enrollment lock as single-watch commands; workers also lock watch rows.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`resource-release-watch:${input.userId}`},0))`,
    );
    const [actor] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userId))
      .for("share")
      .limit(1);
    if (!actor) throw new NotFoundError("Library account");
    const rows = await tx
      .select(fields)
      .from(watches)
      .where(
        and(
          eq(watches.userId, input.userId),
          inArray(
            watches.productId,
            command.items.map((item) => item.productId),
          ),
        ),
      )
      .orderBy(asc(watches.productId))
      .for("no key update");
    if (rows.length !== command.items.length) throw fail();
    const byId = new Map(rows.map((row) => [row.productId, row]));
    const previous = command.items.map((item) => {
      const row = byId.get(item.productId);
      if (!row) throw fail();
      return { item, row };
    });
    const matching = previous.every(
      ({ item, row }) => row.enabled === false && row.revision === item.expectedRevision + 1,
    );
    if (matching) return { items: previous.map(({ row }) => row), changedCount: 0 };
    // Reject mixed replay/current states: all changes are reviewed and applied together.
    if (
      previous.some(
        ({ item, row }) => row.enabled !== true || row.revision !== item.expectedRevision,
      )
    )
      throw fail();
    const [clock] = await tx.execute<{ observedAt: string }>(
      sql`select date_trunc('milliseconds',clock_timestamp())::text AS "observedAt"`,
    );
    const observedAt = new Date(clock?.observedAt ?? "");
    if (!Number.isFinite(observedAt.getTime())) throw fail();
    const updated = await tx.execute<{
      productId: string;
      enabled: boolean;
      revision: number;
      updatedAt: Date | string;
    }>(sql`
      WITH requested AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(command.items)}::jsonb) AS r("productId" text,"expectedRevision" integer))
      UPDATE ${watches} AS watch SET enabled=false,revision=watch.revision+1,
        updated_at=greatest(${observedAt.toISOString()}::timestamptz,watch.updated_at+interval '1 millisecond')
      FROM requested r WHERE watch.user_id=${input.userId} AND watch.product_id=r."productId"
        AND watch.revision=r."expectedRevision" AND watch.enabled=true
      RETURNING watch.product_id AS "productId",watch.enabled,watch.revision,watch.updated_at AS "updatedAt"`);
    if (updated.length !== command.items.length) throw fail();
    const resultById = new Map(
      updated.map((row) => [
        row.productId,
        {
          productId: row.productId,
          enabled: row.enabled,
          revision: row.revision,
          updatedAt: new Date(row.updatedAt),
        },
      ]),
    );
    const items = command.items.map((item) => {
      const row = resultById.get(item.productId);
      if (
        row?.enabled !== false ||
        row.revision !== item.expectedRevision + 1 ||
        !Number.isFinite(row.updatedAt.getTime())
      )
        throw fail();
      return row;
    });
    await tx.insert(auditEvents).values({
      id: input.auditId,
      actorId: input.userId,
      actorType: "user",
      action: "library.release_watches_disabled",
      targetType: "user",
      targetId: input.userId,
      details: {
        items: items.map(({ productId, revision }) => ({ productId, revision })),
        changedCount: items.length,
      },
    });
    return { items, changedCount: items.length };
  });
}
