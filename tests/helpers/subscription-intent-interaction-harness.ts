import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { terms } from "../subscriptions-fixtures";
import { flattenReactTestTree } from "./flatten-react-test-tree";

export type SubscriptionIntentInteractionHarness = {
  slots: unknown[];
  cursor: number;
  effects: (() => unknown)[];
  fetch: Mock;
  push: Mock;
  refresh: Mock;
};

/** Props match SubscriptionControls activate so the real component stays assignable. */
type SubscriptionControlsActivate = (props: {
  actorId: string;
  action: "activate";
  planId: string;
  planRevision: number;
  terms: typeof terms;
  scope: "organization";
  scopes: { id: string; name: string }[];
}) => ReactNode;

export const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

/** Shared react mock factory for subscription-intent suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: SubscriptionIntentInteractionHarness) {
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

export function createSubscriptionIntentInteractionHelpers(
  harness: SubscriptionIntentInteractionHarness,
  SubscriptionControls: SubscriptionControlsActivate,
) {
  function render(actorId = "usr_a") {
    harness.cursor = 0;
    harness.effects = [];
    return flattenReactTestTree(
      SubscriptionControls({
        actorId,
        action: "activate",
        planId: "cplan_free",
        planRevision: 2,
        terms,
        scope: "organization",
        scopes: [{ id: "org_a", name: "A" }],
      }) as ReactNode,
    );
  }

  async function mount(actor = "usr_a") {
    harness.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: actor } }));
    render();
    for (const effect of harness.effects) effect();
    await vi.waitFor(() =>
      expect(render().find((n) => n.type === "fieldset")?.props.hidden).toBe(false),
    );
  }

  async function submit() {
    const form = render().find((n) => n.type === "form");
    if (!form) throw new Error("Missing form");
    await (form.props.onSubmit as (e: unknown) => Promise<void>)({
      preventDefault() {},
    });
  }

  function accountPosts() {
    return harness.fetch.mock.calls.filter(([url]) => url === "/api/subscriptions/account");
  }

  beforeEach(() => {
    harness.slots = [];
    harness.fetch.mockReset();
    harness.push.mockReset();
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("window", { dispatchEvent: () => true });
  });

  afterEach(() => vi.unstubAllGlobals());

  return { render, mount, submit, accountPosts };
}
