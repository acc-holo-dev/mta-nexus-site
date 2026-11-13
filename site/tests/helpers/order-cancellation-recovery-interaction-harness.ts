import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { flattenReactTestTree } from "./flatten-react-test-tree";

export type OrderCancellationRecoveryHarness = {
  slots: unknown[];
  cursor: number;
  effects: (() => unknown)[];
  fetch: Mock;
  refresh: Mock;
  actor: string;
  canCancel: boolean;
};

type OrderCancellationFormComponent = (props: {
  actorId: string;
  orderId: string;
  expectedUpdatedAt: string;
  canCancel: boolean;
}) => ReactNode;

export const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

/** Shared react mock factory for order-cancellation recovery suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: OrderCancellationRecoveryHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useId: () => "field",
    useState: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = initial;
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

export function createOrderCancellationRecoveryInteractionHelpers(
  harness: OrderCancellationRecoveryHarness,
  OrderCancellationForm: OrderCancellationFormComponent,
) {
  function render() {
    harness.cursor = 0;
    harness.effects = [];
    return flattenReactTestTree(
      OrderCancellationForm({
        actorId: harness.actor,
        orderId: "ord_a",
        expectedUpdatedAt: "2026-10-10T12:00:00.000Z",
        canCancel: harness.canCancel,
      }) as ReactNode,
    );
  }

  async function mount() {
    harness.fetch.mockResolvedValueOnce(
      reply({ authenticated: true, user: { id: harness.actor } }),
    );
    render();
    for (const effect of harness.effects) effect();
    await vi.waitFor(() => {
      const nodes = render();
      expect(
        nodes.some((n) => n.type === "fieldset" && n.props.disabled === false) ||
          nodes.some(
            (n) =>
              n.type === "button" &&
              n.props.children === "Retry the same request" &&
              n.props.disabled === false,
          ),
      ).toBe(true);
    });
  }

  function prepare() {
    const reason = render().find((n) => n.type === "textarea");
    if (!reason) throw Error("Missing reason");
    (reason.props.onChange as (e: unknown) => void)({ target: { value: "Not needed" } });
    const check = render().find((n) => n.type === "input" && n.props.type === "checkbox");
    if (!check) throw Error("Missing confirmation");
    (check.props.onChange as (e: unknown) => void)({ target: { checked: true } });
  }

  async function submit() {
    const form = render().find((n) => n.type === "form");
    if (!form) throw Error("Missing form");
    await (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
  }

  function cancelPosts() {
    return harness.fetch.mock.calls.filter(([url]) => url === "/api/orders/ord_a/cancel");
  }

  beforeEach(() => {
    harness.slots = [];
    harness.actor = "usr_a";
    harness.canCancel = true;
    harness.fetch.mockReset();
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
    prepare,
    submit,
    cancelPosts,
  };
}
