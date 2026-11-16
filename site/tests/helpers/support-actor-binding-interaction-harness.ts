import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { flattenReactTestTree } from "./flatten-react-test-tree";

type SupportActorBindingHarness = {
  slots: unknown[];
  cursor: number;
  effects: (() => unknown)[];
  fetch: Mock;
  clear: Mock;
  scope: Mock;
  caseReserve: Mock;
  replyReserve: Mock;
};

type SupportCenterComponent = (props: { actorId: string }) => ReactNode;
type SupportCaseThreadComponent = (props: { actorId: string; caseId: string }) => ReactNode;

const caseId = `sup_${"a".repeat(24)}`;

export const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const openThreadPayload = {
  actorId: "usr_a",
  supportCase: {
    id: caseId,
    category: "account",
    subject: "Help",
    status: "open",
    updatedAt: "2026-10-08T05:00:00.000Z",
  },
  messages: [],
  messagePage: 1,
  messageTotalPages: 1,
  messageTotal: 0,
  requester: true,
  staff: false,
};

/** Shared react mock factory for support actor-binding suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: SupportActorBindingHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
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
    useCallback: (callback: unknown) => {
      harness.cursor++;
      return callback;
    },
  });
}

export function createSupportActorBindingInteractionHelpers(
  harness: SupportActorBindingHarness,
  SupportCenter: SupportCenterComponent,
  SupportCaseThread: SupportCaseThreadComponent,
) {
  function render() {
    harness.cursor = 0;
    harness.effects = [];
    return flattenReactTestTree(SupportCenter({ actorId: "usr_a" }) as ReactNode);
  }

  function renderThread() {
    harness.cursor = 0;
    harness.effects = [];
    return flattenReactTestTree(SupportCaseThread({ actorId: "usr_a", caseId }) as ReactNode);
  }

  function fillCaseForm(nodes = render()) {
    const subject = nodes.find(
      (node) => typeof node.props.label === "string" && node.props.minLength === 5,
    );
    const message = nodes.find((node) => node.type === "textarea");
    if (!subject || !message) throw Error("Missing support fields");
    (subject.props.onChange as (event: unknown) => void)({ target: { value: "Private question" } });
    (message.props.onChange as (event: unknown) => void)({
      target: { value: "Private support details" },
    });
  }

  function caseForm() {
    const form = render().find((node) => typeof node.props.onSubmit === "function");
    if (!form) throw Error("Missing support form");
    return form;
  }

  async function loadOpenThread() {
    harness.fetch.mockResolvedValueOnce(reply(openThreadPayload));
    renderThread();
    for (const effect of harness.effects) effect();
    await vi.waitFor(() =>
      expect(renderThread().find((node) => node.type === "textarea")).toBeDefined(),
    );
  }

  function fillReply(body = "Original private reply") {
    const text = renderThread().find((node) => node.type === "textarea");
    if (!text) throw Error("Missing reply");
    (text.props.onChange as (event: unknown) => void)({ target: { value: body } });
  }

  function replyForm() {
    const form = renderThread().find((node) => typeof node.props.onSubmit === "function");
    if (!form) throw Error("Missing reply form");
    return form;
  }

  beforeEach(() => {
    harness.slots = [];
    harness.effects = [];
    harness.fetch.mockReset();
    harness.clear.mockReset();
    harness.scope.mockReset().mockResolvedValue("b".repeat(64));
    harness.caseReserve.mockClear();
    harness.replyReserve.mockClear();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  return {
    render,
    renderThread,
    fillCaseForm,
    caseForm,
    loadOpenThread,
    fillReply,
    replyForm,
  };
}
