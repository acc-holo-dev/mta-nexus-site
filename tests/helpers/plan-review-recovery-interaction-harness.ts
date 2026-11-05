import { createHash } from "node:crypto";
import { commercialFeeEstimate } from "@nexus/domain";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { flattenReactTestTree } from "./flatten-react-test-tree";

export type PlanReviewRecoveryHarness = {
  slots: unknown[];
  cursor: number;
  effects: (() => unknown)[];
  fetch: Mock;
  push: Mock;
  refresh: Mock;
  locale: "en" | "ru";
};

/** Exact fixture literals so real form props stay assignable under strictFunctionTypes. */
const terms = {
  titleRu: "Тариф",
  titleEn: "Plan",
  descriptionRu: "Описание тарифа",
  descriptionEn: "Plan description",
  price: 900,
  currency: "USD" as const,
  durationDays: 30 as const,
  commissionBps: 750,
};

const plan = {
  ...terms,
  id: "cplan_a",
  slug: "plan",
  scope: "organization" as const,
  status: "published" as const,
  revision: 2,
};

export const scopes = [
  { id: "org_a", name: "Organization A" },
  { id: "org_b", name: "Organization B" },
];

type PlanFixture = Omit<typeof plan, "revision"> & { revision: number };

type PlanReviewFormComponent = (props: {
  actorId: string;
  plan: PlanFixture;
  scopes: { id: string; name: string }[];
}) => ReactNode;

export const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for plan-review recovery suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: PlanReviewRecoveryHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useId: () => "field",
    useState: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots))
        harness.slots[i] = typeof initial === "function" ? initial() : initial;
      return [
        harness.slots[i],
        (value: unknown) => {
          harness.slots[i] = typeof value === "function" ? value(harness.slots[i]) : value;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = { current: initial };
      return harness.slots[i];
    },
    useEffect: (effect: () => unknown) => {
      harness.effects.push(effect);
    },
  });
}

export function responseFor(
  command: {
    requestId: string;
    planId: string;
    expectedRevision: number;
    grossAmount: number;
    currency: "USD" | "EUR" | "RUB";
    organizationId?: string;
  },
  actorId = "usr_a",
) {
  return reply({
    review: {
      id: `prev_${createHash("sha256").update(`${actorId}:${command.requestId.toLowerCase()}`).digest("hex")}`,
      planId: command.planId,
      planRevision: command.expectedRevision,
      scope: command.organizationId ? "organization" : "user",
      subjectId: command.organizationId ?? actorId,
      createdAt: "2026-10-11T00:00:00.000Z",
      terms,
      estimate: commercialFeeEstimate(command.grossAmount, command.currency, terms.commissionBps),
    },
    replayed: true,
  });
}

export function createPlanReviewRecoveryInteractionHelpers(
  harness: PlanReviewRecoveryHarness,
  PlanReviewForm: PlanReviewFormComponent,
) {
  function render(actorId = "usr_a", revision = 2) {
    harness.cursor = 0;
    harness.effects = [];
    return flattenReactTestTree(
      PlanReviewForm({ actorId, plan: { ...plan, revision }, scopes }) as ReactNode,
    );
  }

  async function mount(actorId = "usr_a", currentActor = actorId, revision = 2) {
    harness.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: currentActor } }));
    render(actorId, revision);
    for (const effect of harness.effects) effect();
    await vi.waitFor(() =>
      expect(render(actorId, revision).find((node) => node.type === "form")?.props.hidden).toBe(
        false,
      ),
    );
  }

  async function submit(actorId = "usr_a", revision = 2) {
    const form = render(actorId, revision).find((node) => node.type === "form");
    if (!form) throw Error("Missing review form");
    await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  }

  function reviewPosts() {
    return harness.fetch.mock.calls.filter(([url]) => url === "/api/subscriptions/reviews");
  }

  beforeEach(() => {
    harness.slots = [];
    harness.effects = [];
    harness.locale = "en";
    harness.fetch.mockReset();
    harness.push.mockReset();
    harness.refresh.mockReset();
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  return {
    render,
    mount,
    submit,
    reviewPosts,
  };
}
