import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { flattenReactTestTree } from "./flatten-react-test-tree";

export type ServerRegistrationRecoveryHarness = {
  slots: unknown[];
  cursor: number;
  effects: (() => unknown)[];
  fetch: Mock;
  locale: "en" | "ru";
};

type RegisterServerFormComponent = (props: { actorId: string }) => ReactNode;

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

class TestFormData {
  get(name: string) {
    return (
      (
        { name: "My Server", slug: "my-server", ipAddress: "198.51.100.1" } as Record<
          string,
          string
        >
      )[name] ?? null
    );
  }
  *entries() {
    yield* Object.entries({ name: "My Server", slug: "my-server", ipAddress: "198.51.100.1" });
  }
}

/** Shared react mock factory for server-registration recovery suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ServerRegistrationRecoveryHarness) {
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

export function createServerRegistrationRecoveryInteractionHelpers(
  harness: ServerRegistrationRecoveryHarness,
  RegisterServerForm: RegisterServerFormComponent,
) {
  function render() {
    harness.cursor = 0;
    harness.effects = [];
    return flattenReactTestTree(RegisterServerForm({ actorId: "usr_a" }) as ReactNode);
  }

  async function mount() {
    harness.fetch.mockImplementation(async (url: string) =>
      url === "/api/auth/session"
        ? response({ authenticated: true, user: { id: "usr_a" } })
        : response({ organizations: [] }),
    );
    render();
    for (const effect of harness.effects) effect();
    await vi.waitFor(() =>
      expect(render().find((n) => n.type === "form")?.props.hidden).toBe(false),
    );
  }

  async function submit() {
    const form = render().find((n) => n.type === "form");
    if (!form) throw new Error("Missing form");
    await (form.props.onSubmit as (e: unknown) => Promise<void>)({
      preventDefault() {},
      currentTarget: {},
    });
  }

  beforeEach(() => {
    harness.slots = [];
    harness.locale = "en";
    harness.cursor = 0;
    harness.effects = [];
    harness.fetch.mockReset();
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    });
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("FormData", TestFormData);
  });

  afterEach(() => vi.unstubAllGlobals());

  return {
    render,
    mount,
    submit,
  };
}
