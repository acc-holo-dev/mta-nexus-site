import type { CommercialPlan } from "@nexus/domain";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { flattenReactTestTree } from "./flatten-react-test-tree";

type CommercialPlanFormConfirmHarness = {
  slots: unknown[];
  cursor: number;
  effects: (() => unknown)[];
  fetch: Mock;
  push: Mock;
  refresh: Mock;
  actor: string;
  confirm: Mock;
};

type CommercialPlanFormComponent = (props: {
  actorId: string;
  plan?: Omit<CommercialPlan, "updatedAt">;
}) => ReactNode;

export const reply = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });

/** Shared react mock factory for commercial-plan form confirm suites. */
export function mockReactHooks(harness: CommercialPlanFormConfirmHarness) {
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

export function createCommercialPlanFormConfirmInteractionHelpers(
  harness: CommercialPlanFormConfirmHarness,
  CommercialPlanForm: CommercialPlanFormComponent,
) {
  let activePlan: Omit<CommercialPlan, "updatedAt"> | undefined;

  function render() {
    harness.cursor = 0;
    harness.effects = [];
    return flattenReactTestTree(
      CommercialPlanForm({ actorId: harness.actor, plan: activePlan }) as ReactNode,
    );
  }

  async function mount(actor = harness.actor, plan?: Omit<CommercialPlan, "updatedAt">) {
    activePlan = plan;
    harness.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: actor } }));
    render();
    for (const effect of harness.effects) effect();
    await vi.waitFor(() => expect(render().some((n) => n.type === "form")).toBe(true));
  }

  function fill(id: string, value: string) {
    const field = render().find((n) => n.props.id === `field-${id}`);
    if (!field) throw Error(`Missing ${id}`);
    (field.props.onChange as (event: unknown) => void)({ target: { value } });
  }

  function prepare() {
    fill("slug", "seller-plan");
    fill("titleRu", "Тариф");
    fill("titleEn", "Seller plan");
    fill("descriptionRu", "Описание тарифа");
    fill("descriptionEn", "Seller plan details");
    fill("reason", "Valid reason");
  }

  async function submit() {
    const form = render().find((n) => n.type === "form");
    if (!form) throw Error("Missing form");
    await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  }

  function planPosts() {
    return harness.fetch.mock.calls.filter(([url]) =>
      String(url).startsWith("/api/admin/commerce/plans"),
    );
  }

  function lifecycleButton(label: string) {
    return render().find((n) => n.type === "button" && n.props.children === label);
  }

  async function clickLifecycle(label: string) {
    const button = lifecycleButton(label);
    if (!button) throw Error(`Missing lifecycle button ${label}`);
    await (button.props.onClick as () => Promise<void>)();
  }

  function acknowledgementButton() {
    return render().find((n) => n.type === "button" && n.props.children === "I checked the result");
  }

  beforeEach(() => {
    harness.slots = [];
    harness.actor = "usr_a";
    activePlan = undefined;
    harness.fetch.mockReset();
    harness.push.mockReset();
    harness.refresh.mockReset();
    harness.confirm.mockReset().mockResolvedValue(true);
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
    fill,
    prepare,
    submit,
    planPosts,
    lifecycleButton,
    clickLifecycle,
    acknowledgementButton,
  };
}
