import {
  type AdPlacementPlan,
  type AdPlacementStatus,
  type AdSlotPlan,
  adPlacementHoldsCapacity,
  adPlacementIsServeable,
  adSlotCapacityIsRespected,
  assertAdPlacementTransition,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@nexus/domain";
import { and, count, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../client";
import { adPlacements, adSlots, auditEvents, products, servers } from "../schema";

/**
 * UX-24 -- managed advertising placement.
 *
 * A slot is distinguished from a placement: the slot is reserved inventory on a
 * page position, the placement is one booked instance with a time window, an
 * optional impression cap, an audience scope and a moderation basis.
 *
 * Every lifecycle move goes through assertAdPlacementTransition; capacity and
 * eligibility are re-checked at transition and at serve time, never inferred
 * from stored state. Management operations require an admin operator. Pausing
 * and rejecting always carry a reason and write an audit event. The status
 * change and that audit event commit in the same transaction.
 */
export type AdActor = { id: string; isAdmin: boolean };

const activeStatuses: AdPlacementStatus[] = ["scheduled", "live", "paused"];

type AdExecutor = Pick<typeof db, "select" | "update" | "insert">;

function requireOperator(actor: AdActor): void {
  if (!actor.isAdmin) {
    throw new ForbiddenError("Ad placement management requires an admin operator");
  }
}

export class AdPlacementRepository {
  // ---------------- reads ----------------
  async listSlots(): Promise<AdSlotPlan[]> {
    return (await db
      .select()
      .from(adSlots)
      .orderBy(desc(adSlots.updatedAt))) as unknown as AdSlotPlan[];
  }

  async placementsForSlot(slotId: string): Promise<AdPlacementPlan[]> {
    return (await db
      .select()
      .from(adPlacements)
      .where(eq(adPlacements.slotId, slotId))
      .orderBy(desc(adPlacements.createdAt))) as unknown as AdPlacementPlan[];
  }

  async activeCount(slotId: string): Promise<number> {
    return this.countActive(db, slotId);
  }

  async placement(id: string): Promise<AdPlacementPlan> {
    return this.readPlacement(db, id);
  }

  // ---------------- writes ----------------
  async create(
    actor: AdActor,
    input: {
      id: string;
      slotId: string;
      advertiserUserId: string;
      targetType: "product" | "server";
      targetId: string;
      startsAt: Date;
      endsAt: Date;
      maxImpressions?: number;
      audience?: string[];
      moderationBasis?: string;
    },
  ): Promise<AdPlacementPlan> {
    requireOperator(actor);
    if (input.endsAt <= input.startsAt) {
      throw new ForbiddenError("Ad placement end must be later than start");
    }
    const [row] = await db
      .insert(adPlacements)
      .values({ ...input, status: "draft", createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return row as unknown as AdPlacementPlan;
  }

  async submitForApproval(id: string): Promise<AdPlacementPlan> {
    return this.transition(id, "pending_approval");
  }

  /**
   * Reserve capacity under the slot row lock, then commit `scheduled` and its
   * audit event together. A second approve waits and sees the reservation;
   * a failed audit write rolls the status back.
   */
  async approve(actor: AdActor, id: string): Promise<AdPlacementPlan> {
    requireOperator(actor);
    return db.transaction(async (tx) => {
      const peeked = await this.readPlacement(tx, id);
      const [slot] = await tx
        .select({ capacity: adSlots.capacity })
        .from(adSlots)
        .where(eq(adSlots.id, peeked.slotId))
        .limit(1)
        .for("update");
      if (!slot) throw new NotFoundError("Ad slot", peeked.slotId);
      const current = await this.readPlacement(tx, id);
      assertAdPlacementTransition(current.status, "scheduled");
      const active = await this.countActive(tx, current.slotId);
      const projected = active + (adPlacementHoldsCapacity(current.status) ? 0 : 1);
      if (!adSlotCapacityIsRespected({ capacity: slot.capacity, active: projected })) {
        throw new ConflictError("Ad slot capacity would be exceeded");
      }
      return this.writeStatus(tx, id, "scheduled", undefined, actor);
    });
  }

  async reject(actor: AdActor, id: string, reason: string): Promise<AdPlacementPlan> {
    requireOperator(actor);
    assertAdPlacementTransition((await this.placement(id)).status, "rejected", reason);
    return this.transition(id, "rejected", reason, actor);
  }

  async pause(actor: AdActor, id: string, reason: string): Promise<AdPlacementPlan> {
    requireOperator(actor);
    assertAdPlacementTransition((await this.placement(id)).status, "paused", reason);
    return this.transition(id, "paused", reason, actor);
  }

  async resume(actor: AdActor, id: string): Promise<AdPlacementPlan> {
    requireOperator(actor);
    return this.transition(id, "live", undefined, actor);
  }

  async end(actor: AdActor, id: string): Promise<AdPlacementPlan> {
    requireOperator(actor);
    return this.transition(id, "ended", undefined, actor);
  }

  /** Serve-time selection: live placement, active window, enabled slot and an eligible target. */
  async serveable(slotId: string, now: Date): Promise<AdPlacementPlan[]> {
    const [slot] = await db
      .select({ enabled: adSlots.enabled })
      .from(adSlots)
      .where(eq(adSlots.id, slotId))
      .limit(1);
    if (!slot?.enabled) return [];
    const rows = await db
      .select()
      .from(adPlacements)
      .where(
        and(
          eq(adPlacements.slotId, slotId),
          lte(adPlacements.startsAt, now),
          gte(adPlacements.endsAt, now),
        ),
      )
      .limit(50);
    const out: AdPlacementPlan[] = [];
    for (const p of rows as unknown as AdPlacementPlan[]) {
      const eligible = await this.targetEligible(p.targetType, p.targetId);
      if (adPlacementIsServeable({ slot, placement: p, now, targetEligible: eligible })) {
        out.push(p);
      }
    }
    return out;
  }

  private async targetEligible(targetType: string, targetId: string): Promise<boolean> {
    if (targetType === "product") {
      const [prod] = await db
        .select({ status: products.status, isFeatured: products.isFeatured })
        .from(products)
        .where(eq(products.id, targetId))
        .limit(1);
      if (!prod) return false;
      return prod.status === "published" && !prod.isFeatured;
    }
    const [srv] = await db
      .select({ status: servers.status, visibility: servers.visibility })
      .from(servers)
      .where(eq(servers.id, targetId))
      .limit(1);
    if (!srv) return false;
    return srv.status === "active" && srv.visibility === "public";
  }

  private async readPlacement(
    executor: AdExecutor,
    id: string,
    lock = false,
  ): Promise<AdPlacementPlan> {
    const query = executor.select().from(adPlacements).where(eq(adPlacements.id, id)).limit(1);
    const [row] = lock ? await query.for("update") : await query;
    if (!row) throw new NotFoundError("Ad placement", id);
    return row as unknown as AdPlacementPlan;
  }

  private async countActive(executor: AdExecutor, slotId: string): Promise<number> {
    const [row] = await executor
      .select({ n: count() })
      .from(adPlacements)
      .where(and(eq(adPlacements.slotId, slotId), inArray(adPlacements.status, activeStatuses)));
    return Number(row?.n ?? 0);
  }

  private async transition(
    id: string,
    to: AdPlacementStatus,
    reason?: string,
    actor?: AdActor,
  ): Promise<AdPlacementPlan> {
    return db.transaction((tx) => this.writeStatus(tx, id, to, reason, actor));
  }

  private async writeStatus(
    executor: AdExecutor,
    id: string,
    to: AdPlacementStatus,
    reason: string | undefined,
    actor: AdActor | undefined,
  ): Promise<AdPlacementPlan> {
    const current = await this.readPlacement(executor, id, true);
    assertAdPlacementTransition(current.status, to, reason);
    await executor
      .update(adPlacements)
      .set({ status: to, reason: reason ?? null, updatedAt: new Date() })
      .where(eq(adPlacements.id, id));
    if (actor) {
      await this.recordAudit(executor, actor, id, `ad_placement.${to}`, {
        from: current.status,
        reason,
      });
    }
    return this.readPlacement(executor, id);
  }

  private async recordAudit(
    executor: AdExecutor,
    actor: AdActor,
    placementId: string,
    action: string,
    details: Record<string, unknown>,
  ) {
    await executor.insert(auditEvents).values({
      id: crypto.randomUUID(),
      actorId: actor.id,
      actorType: "admin",
      action,
      targetId: placementId,
      targetType: "ad_placement",
      details,
      createdAt: new Date(),
    });
  }
}
