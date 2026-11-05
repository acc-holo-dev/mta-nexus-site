import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { findTestButton, flattenReactTestTree } from "./flatten-react-test-tree";

export type OrganizationCreateRecoveryHarness = {
  slots: unknown[];
  cursor: number;
  effects: (() => unknown)[];
  request: Mock;
  fetch: Mock;
  push: Mock;
  actor: string;
};

type OrganizationProfileFormComponent = (props: {
  locale: "en" | "ru";
  actorId: string;
}) => ReactNode;

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

/** Shared react mock factory for organization-create recovery suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: OrganizationCreateRecoveryHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
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

export function createOrganizationCreateRecoveryInteractionHelpers(
  harness: OrganizationCreateRecoveryHarness,
  OrganizationProfileForm: OrganizationProfileFormComponent,
) {
  function render() {
    harness.cursor = 0;
    harness.effects = [];
    return flattenReactTestTree(
      OrganizationProfileForm({ locale: "en", actorId: harness.actor }) as ReactNode,
    );
  }

  async function mount() {
    harness.fetch.mockImplementation(
      async () => reply({ authenticated: true, user: { id: harness.actor } }),
    );
    render();
    for (const effect of harness.effects) effect();
    await vi.waitFor(() =>
      expect(render().find((n) => n.props.id === "organization-name")).toBeDefined(),
    );
  }

  function fillFields(name = "My organization", slug = "my-organization") {
    let nodes = render();
    const nameInput = nodes.find((n) => n.props.id === "organization-name");
    if (!nameInput) throw new Error("Missing name");
    (nameInput.props.onChange as (e: unknown) => void)({ target: { value: name } });
    nodes = render();
    const slugInput = nodes.find((n) => n.props.id === "organization-slug");
    if (!slugInput) throw new Error("Missing slug");
    (slugInput.props.onChange as (e: unknown) => void)({ target: { value: slug } });
  }

  async function submit() {
    const form = render().find((node) => node.type === "form");
    if (!form) throw new Error("Missing form");
    await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  }

  function checkResultButton() {
    return findTestButton(render(), "Check result");
  }

  beforeEach(() => {
    harness.slots = [];
    harness.cursor = 0;
    harness.effects = [];
    harness.request.mockReset();
    harness.fetch.mockReset();
    harness.push.mockReset();
    harness.actor = "usr_a";
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    });
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  return {
    render,
    mount,
    fillFields,
    submit,
    checkResultButton,
  };
}
