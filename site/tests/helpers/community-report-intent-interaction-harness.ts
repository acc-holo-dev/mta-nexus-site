import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { flattenReactTestTree } from "./flatten-react-test-tree";

export type CommunityReportIntentInteractionHarness = {
  slots: unknown[];
  cursor: number;
  effects: (() => unknown)[];
  fetch: Mock;
};

/** Props match CommunityReportForm so the real component stays assignable. */
type CommunityReportFormComponent = (props: {
  targetType: "comment";
  targetId: string;
  locale: "en";
  actorId: string;
}) => ReactNode;

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for community-report intent suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: CommunityReportIntentInteractionHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots))
        harness.slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        harness.slots[index],
        (value: unknown) => {
          harness.slots[index] = typeof value === "function" ? value(harness.slots[index]) : value;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = { current: initial };
      return harness.slots[index];
    },
    useEffect: (effect: () => unknown) => {
      harness.effects.push(effect);
    },
  });
}

export function createCommunityReportIntentInteractionHelpers(
  harness: CommunityReportIntentInteractionHarness,
  CommunityReportForm: CommunityReportFormComponent,
) {
  function render(actorId = "usr_a") {
    harness.cursor = 0;
    harness.effects = [];
    return flattenReactTestTree(
      CommunityReportForm({
        targetType: "comment",
        targetId: "cmt_a",
        locale: "en",
        actorId,
      }) as ReactNode,
    );
  }

  async function mount() {
    harness.fetch.mockResolvedValueOnce(response({ authenticated: true, user: { id: "usr_a" } }));
    render();
    for (const effect of harness.effects) effect();
    await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());
    await vi.waitFor(() =>
      expect(render().find((node) => node.props.onClick)?.props.onClick).toBeDefined(),
    );
    const open = render().find((node) => node.props.onClick);
    if (!open) throw Error("Missing report button");
    (open.props.onClick as () => void)();
    await vi.waitFor(() => expect(render().find((node) => node.type === "form")).toBeDefined());
  }

  async function submit() {
    const form = render().find((node) => node.type === "form");
    if (!form) throw Error("Missing form");
    await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  }

  function setReason(value: string) {
    const reason = render().find((node) => node.type === "textarea");
    if (!reason) throw Error("Missing reason");
    (reason.props.onChange as (event: unknown) => void)({ target: { value } });
  }

  beforeEach(() => {
    harness.slots = [];
    harness.effects = [];
    harness.fetch.mockReset();
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  return { render, mount, submit, setReason };
}
