import { and, count, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../client";
import { adSlots, adPlacements, products, servers, auditEvents } from "../schema";
import {
  adPlacementHoldsCapacity,
  adPlacementIsServeable,
  adSlotCapacityIsRespected,
  assertAdPlacementTransition,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  type AdPlacementPlan,
  type AdPlacementStatus,
  type AdSlotPlan,
} from "@nexus/domain";

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
 * and rejecting always carry a reason and write an audit event.
 */
export type AdActor = { id: string; isAdmin: boolean };

const activeStatuses: AdPlacementStatus[] = ["scheduled", "live", "paused"];

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
    const [row] = await db
      .select({ n: count() })
      .from(adPlacements)
      .where(and(eq(adPlacements.slotId, slotId), inArray(adPlacements.status, activeStatuses)));
    return Number(row?.n ?? 0);
  }

  async placement(id: string): Promise<AdPlacementPlan> {
    const [row] = await db.select().from(adPlacements).where(eq(adPlacements.id, id)).limit(1);
    if (!row) throw new NotFoundError("Ad placement", id);
    return row as unknown as AdPlacementPlan;
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

  /** Approve after re-checking that this placement keeps the slot within capacity. */
  async approve(actor: AdActor, id: string): Promise<AdPlacementPlan> {
    requireOperator(actor);
    const current = await this.placement(id);
    assertAdPlacementTransition(current.status, "scheduled");
    const [slot] = await db
      .select({ capacity: adSlots.capacity })
      .from(adSlots)
      .where(eq(adSlots.id, current.slotId))
      .limit(1);
    if (!slot) throw new NotFoundError("Ad slot", current.slotId);
    const active = await this.activeCount(current.slotId);
    const projected = active + (adPlacementHoldsCapacity(current.status) ? 0 : 1);
    if (!adSlotCapacityIsRespected({ capacity: slot.capacity, active: projected })) {
      throw new ConflictError("Ad slot capacity would be exceeded");
    }
    return this.transition(id, "scheduled", undefined, actor);
  }

  async reject(actor: AdActor, id: string, reason: string): Promise<AdPlacementPlan> {
    requireOperator(actor);
    assertAdPlacementTransition((await this.placement(id)).status, "rejected", reason);
    return this.transition(id, "rejected", reason, actor);
  }

  async pause(actor: AdActor, id: string, reason: string): Promise<AdPlacementPlan> {
    requireOperator(actor);
    const current = await this.placement(id);
    assertAdPlacementTransition(current.status, "paused", reason);
    await db
      .update(adPlacements)
      .set({ status: "paused", reason, updatedAt: new Date() })
      .where(eq(adPlacements.id, id));
    await this.recordAudit(actor, id, "ad_placement.paused", { from: current.status, reason });
    return this.placement(id);
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

  private async transition(
    id: string,
    to: AdPlacementStatus,
    reason?: string,
    actor?: AdActor,
  ): Promise<AdPlacementPlan> {
    const current = await this.placement(id);
    assertAdPlacementTransition(current.status, to, reason);
    await db
      .update(adPlacements)
      .set({ status: to, reason: reason ?? null, updatedAt: new Date() })
      .where(eq(adPlacements.id, id));
    if (actor) {
      await this.recordAudit(actor, id, `ad_placement.${to}`, { from: current.status, reason });
    }
    return this.placement(id);
  }

  private async recordAudit(
    actor: AdActor,
    placementId: string,
    action: string,
    details: Record<string, unknown>,
  ) {
    await db.insert(auditEvents).values({
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
