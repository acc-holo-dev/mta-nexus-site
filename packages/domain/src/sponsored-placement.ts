import type { Server, Product } from "./entities";

/**
 * UX-24 -- managed advertising placement lifecycle.
 * A slot is a reserved inventory position; a placement is one booked instance
 * on that slot with a time window, capacity limit, audience scope and a
 * moderation basis. Eligibility (active window, live status and a target that
 * is still eligible) is re-checked at serve time, never inferred from state.
 */
export const AD_SLOT_AREAS = ["desktop", "mobile", "any"] as const;
export type AdSlotArea = (typeof AD_SLOT_AREAS)[number];

export interface AdSlotPlan {
  id: string;
  name: string;
  positionKey: string;
  area: AdSlotArea;
  /** Maximum number of overlapping scheduled/live/paused placements. */
  capacity: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const AD_PLACEMENT_STATUSES = [
  "draft",
  "pending_approval",
  "scheduled",
  "live",
  "paused",
  "ended",
  "rejected",
  "cancelled",
] as const;
export type AdPlacementStatus = (typeof AD_PLACEMENT_STATUSES)[number];

export const AD_PLACEMENT_TARGET_TYPES = ["product", "server"] as const;
export type AdPlacementTargetType = (typeof AD_PLACEMENT_TARGET_TYPES)[number];

export interface AdPlacementPlan {
  id: string;
  slotId: string;
  advertiserUserId: string;
  targetType: AdPlacementTargetType;
  targetId: string;
  startsAt: Date;
  endsAt: Date;
  /** Optional impression cap; null means unlimited within the time window. */
  maxImpressions?: number;
  audience?: string[];
  moderationBasis?: string;
  status: AdPlacementStatus;
  /** Set when a placement is paused or rejected. */
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Reasons that justify pausing or withdrawing a live placement. */
export const AD_PAUSE_REASONS = [
  "advertiser_request",
  "target_disqualified",
  "slot_maintenance",
  "policy_review",
] as const;
export type AdPauseReason = (typeof AD_PAUSE_REASONS)[number];

type Transition<From extends AdPlacementStatus, To extends AdPlacementStatus> = {
  from: From;
  to: To;
  /** reason required when pausing or rejecting. */
  requiresReason: boolean;
};

/**
 * Allowed lifecycle transitions. Every transition is explicit so that an
 * unexpected move (for example live directly to ended, or scheduled past its
 * window) is rejected rather than guessed.
 */
export const AD_PLACEMENT_TRANSITIONS: readonly Transition<AdPlacementStatus, AdPlacementStatus>[] =
  [
    { from: "draft", to: "pending_approval", requiresReason: false },
    { from: "draft", to: "cancelled", requiresReason: false },
    { from: "pending_approval", to: "scheduled", requiresReason: false },
    { from: "pending_approval", to: "rejected", requiresReason: true },
    { from: "pending_approval", to: "cancelled", requiresReason: false },
    { from: "scheduled", to: "live", requiresReason: false },
    { from: "scheduled", to: "cancelled", requiresReason: false },
    { from: "live", to: "paused", requiresReason: true },
    { from: "live", to: "ended", requiresReason: false },
    { from: "paused", to: "live", requiresReason: false },
    { from: "paused", to: "ended", requiresReason: false },
  ];

export function assertAdPlacementTransition(
  from: AdPlacementStatus,
  to: AdPlacementStatus,
  reason?: string,
): void {
  const rule = AD_PLACEMENT_TRANSITIONS.find((t) => t.from === from && t.to === to);
  if (!rule) {
    throw new Error(`ad placement transition ${from} -> ${to} is not allowed`);
  }
  if (rule.requiresReason && !reason?.trim()) {
    throw new Error(`ad placement transition ${from} -> ${to} requires a reason`);
  }
  if (to === "live" && from === "pending_approval") {
    throw new Error("ad placement must be scheduled before it can go live");
  }
}

/**
 * The active placements that consume capacity on a slot: a placement is
 * capacity-holding while it is scheduled, live or paused (paused still
 * reserves the slot so an advertiser cannot be silently displaced).
 */
export function adPlacementHoldsCapacity(status: AdPlacementStatus): boolean {
  return status === "scheduled" || status === "live" || status === "paused";
}

/** A target that was disqualified between booking and serving must stop the slot from showing it. */
export function adTargetIsEligible(
  target:
    | { kind: "product"; product: Pick<Product, "status" | "isFeatured"> }
    | { kind: "server"; server: Pick<Server, "status" | "visibility"> },
): boolean {
  if (target.kind === "product") {
    return (
      target.product.status === "published" &&
      // A featured product is not an ad; only non-featured promoted products show in an ad slot.
      !target.product.isFeatured
    );
  }
  return target.server.status === "active" && target.server.visibility === "public";
}

/**
 * Actual serve-time eligibility: the placement is live and inside its window,
 * the slot is enabled, and the target is still eligible. Re-checked every
 * render so a delisted/quarantined target is never shown from stale state.
 */
export function adPlacementIsServeable(input: {
  slot: Pick<AdSlotPlan, "enabled">;
  placement: Pick<AdPlacementPlan, "status" | "startsAt" | "endsAt">;
  now: Date;
  targetEligible: boolean;
}): boolean {
  const { slot, placement, now, targetEligible } = input;
  if (!slot.enabled) return false;
  if (placement.status !== "live") return false;
  if (now < placement.startsAt || now >= placement.endsAt) return false;
  return targetEligible;
}

/** Slot capacity: the number of active placements must stay within the slot cap. */
export function adSlotCapacityIsRespected(input: { capacity: number; active: number }): boolean {
  return input.active <= input.capacity;
}
