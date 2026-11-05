import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { flattenReactTestTree } from "./flatten-react-test-tree";

type ServerClaimActorRecoveryHarness = {
  slots: unknown[];
  cursor: number;
  effects: (() => unknown)[];
  fetch: Mock;
};

type ServerClaimControlPanelComponent = (props: {
  serverId: string;
  serverName: string;
  expectedActorId: string | null;
}) => ReactNode;

export const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const issueResponse = {
  challenge: {
    challengeId: "scc_00000000-0000-4000-8000-000000000001",
    token: "NXCLAIM-ABCDEF0123456789ABCDEF01",
    expiresAt: "2099-01-01T00:00:00.000Z",
    server: { id: "srv_a" },
  },
};

/** Shared react mock factory for server-claim recovery suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ServerClaimActorRecoveryHarness) {
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
  });
}

export function createServerClaimActorRecoveryInteractionHelpers(
  harness: ServerClaimActorRecoveryHarness,
  ServerClaimControlPanel: ServerClaimControlPanelComponent,
) {
  function render(expectedActorId: string | null = "usr_a") {
    harness.cursor = 0;
    harness.effects = [];
    return flattenReactTestTree(
      ServerClaimControlPanel({
        serverId: "srv_a",
        serverName: "Demo",
        expectedActorId,
      }) as ReactNode,
    );
  }

  async function mount(expectedActorId: string | null = "usr_a", actor = "usr_a") {
    harness.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: actor } }));
    render(expectedActorId);
    for (const effect of harness.effects) effect();
    await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());
  }

  function click(label: string, expectedActorId: string | null = "usr_a") {
    const button = render(expectedActorId).find(
      (node) => node.type === "button" && node.props.children === label,
    );
    if (!button || typeof button.props.onClick !== "function") throw Error(`Missing ${label}`);
    (button.props.onClick as () => void)();
  }

  async function waitUntilReady(expectedActorId: string | null = "usr_a") {
    await vi.waitFor(() =>
      expect(
        render(expectedActorId).find((node) => node.type === "button" && node.props.onClick)?.props
          .disabled,
      ).toBe(false),
    );
  }

  function hasCopy(text: string, expectedActorId: string | null = "usr_a") {
    return render(expectedActorId).some(
      (node) => typeof node.props.children === "string" && node.props.children.includes(text),
    );
  }

  function attachWindowEvents() {
    const listeners = new Map<string, () => void>();
    vi.stubGlobal("window", {
      addEventListener: (name: string, callback: () => void) =>
        listeners.set(`window:${name}`, callback),
      removeEventListener: () => {},
    });
    vi.stubGlobal("document", {
      visibilityState: "visible",
      addEventListener: (name: string, callback: () => void) =>
        listeners.set(`document:${name}`, callback),
      removeEventListener: () => {},
    });
    render();
    const effect = harness.effects[1];
    if (!effect) throw Error("Missing identity effect");
    effect();
    return listeners;
  }

  beforeEach(() => {
    harness.slots = [];
    harness.cursor = 0;
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

  return {
    render,
    mount,
    click,
    waitUntilReady,
    hasCopy,
    attachWindowEvents,
  };
}
