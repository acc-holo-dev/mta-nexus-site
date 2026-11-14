import { describe, expect, it } from "vitest";
import {
  adPlacementHoldsCapacity,
  adPlacementIsServeable,
  adSlotCapacityIsRespected,
  adTargetIsEligible,
  assertAdPlacementTransition,
} from "@nexus/domain";

const t = new Date("2026-12-01T12:00:00Z");

describe("ad placement lifecycle (UX-24)", () => {
  it("only allows explicit lifecycle transitions", () => {
    expect(() => assertAdPlacementTransition("draft", "pending_approval")).not.toThrow();
    expect(() => assertAdPlacementTransition("pending_approval", "scheduled")).not.toThrow();
    expect(() => assertAdPlacementTransition("scheduled", "live")).not.toThrow();
    expect(() => assertAdPlacementTransition("live", "paused", "advertiser_request")).not.toThrow();
    expect(() => assertAdPlacementTransition("paused", "live")).not.toThrow();
    expect(() => assertAdPlacementTransition("live", "ended")).not.toThrow();
  });

  it("rejects impossible transitions", () => {
    expect(() => assertAdPlacementTransition("draft", "live")).toThrow();
    expect(() => assertAdPlacementTransition("draft", "ended")).toThrow();
    expect(() => assertAdPlacementTransition("ended", "live")).toThrow();
    expect(() => assertAdPlacementTransition("rejected", "scheduled")).toThrow();
  });

  it("requires a reason to pause or reject but not to resume", () => {
    expect(() => assertAdPlacementTransition("live", "paused")).toThrow();
    expect(() => assertAdPlacementTransition("live", "paused", "")).toThrow();
    expect(() =>
      assertAdPlacementTransition("pending_approval", "rejected", "policy_review"),
    ).not.toThrow();
    expect(() => assertAdPlacementTransition("paused", "live")).not.toThrow();
  });

  it("treats scheduled, live and paused as capacity-holding; ended and rejected are not", () => {
    expect(adPlacementHoldsCapacity("scheduled")).toBe(true);
    expect(adPlacementHoldsCapacity("live")).toBe(true);
    expect(adPlacementHoldsCapacity("paused")).toBe(true);
    expect(adPlacementHoldsCapacity("ended")).toBe(false);
    expect(adPlacementHoldsCapacity("rejected")).toBe(false);
    expect(adPlacementHoldsCapacity("cancelled")).toBe(false);
  });

  it("respects slot capacity with exact boundary", () => {
    expect(adSlotCapacityIsRespected({ capacity: 1, active: 1 })).toBe(true);
    expect(adSlotCapacityIsRespected({ capacity: 1, active: 2 })).toBe(false);
    expect(adSlotCapacityIsRespected({ capacity: 3, active: 3 })).toBe(true);
    expect(adSlotCapacityIsRespected({ capacity: 3, active: 4 })).toBe(false);
  });

  describe("adTargetIsEligible", () => {
    it("accepts a published, non-featured product", () => {
      expect(
        adTargetIsEligible({
          kind: "product",
          product: { status: "published", isFeatured: false },
        }),
      ).toBe(true);
    });
    it("rejects draft/suspended/archived and featured products", () => {
      expect(
        adTargetIsEligible({ kind: "product", product: { status: "draft", isFeatured: false } }),
      ).toBe(false);
      expect(
        adTargetIsEligible({ kind: "product", product: { status: "published", isFeatured: true } }),
      ).toBe(false);
      expect(
        adTargetIsEligible({
          kind: "product",
          product: { status: "suspended", isFeatured: false },
        }),
      ).toBe(false);
    });
    it("accepts an active, public server", () => {
      expect(
        adTargetIsEligible({ kind: "server", server: { status: "active", visibility: "public" } }),
      ).toBe(true);
    });
    it("rejects inactive/maintenance and non-public servers", () => {
      expect(
        adTargetIsEligible({
          kind: "server",
          server: { status: "inactive", visibility: "public" },
        }),
      ).toBe(false);
      expect(
        adTargetIsEligible({
          kind: "server",
          server: { status: "active", visibility: "unlisted" },
        }),
      ).toBe(false);
      expect(
        adTargetIsEligible({
          kind: "server",
          server: { status: "suspended", visibility: "public" },
        }),
      ).toBe(false);
    });
  });

  describe("adPlacementIsServeable", () => {
    const slot = { enabled: true };
    const base = {
      slot,
      placement: {
        status: "live",
        startsAt: new Date("2026-12-01T00:00:00Z"),
        endsAt: new Date("2026-12-31T23:59:59Z"),
      },
      now: t,
      targetEligible: true,
    } as const;

    it("serves a live placement inside its window with an eligible target", () => {
      expect(adPlacementIsServeable({ ...base })).toBe(true);
    });

    it("does not serve before start or at/after end (boundary)", () => {
      const before = { ...base, now: new Date("2026-11-30T00:00:00Z") };
      // use a fresh window for equality boundary
      const atEnd = {
        slot,
        placement: {
          status: "live" as const,
          startsAt: new Date("2026-12-01T00:00:00Z"),
          endsAt: t,
        },
        now: t,
        targetEligible: true,
      };
      expect(adPlacementIsServeable(before)).toBe(false);
      expect(adPlacementIsServeable(atEnd)).toBe(false);
    });

    it("treats the window start as inclusive", () => {
      const atStart = {
        ...base,
        now: new Date("2026-12-01T00:00:00Z"),
      };
      expect(adPlacementIsServeable(atStart)).toBe(true);
    });

    it("does not serve non-live placements", () => {
      ["scheduled", "paused", "pending_approval", "draft"].forEach((status) => {
        expect(
          adPlacementIsServeable({ ...base, placement: { ...base.placement, status } as never }),
        ).toBe(false);
      });
    });

    it("does not serve a disabled slot or a disqualified target (quarantine/no-fill)", () => {
      expect(adPlacementIsServeable({ ...base, slot: { enabled: false } })).toBe(false);
      expect(adPlacementIsServeable({ ...base, targetEligible: false })).toBe(false);
    });
  });
});
