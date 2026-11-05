import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { flattenReactTestTree } from "./flatten-react-test-tree";

export type NewResourceSubmissionHarness = {
  slots: unknown[];
  cursor: number;
  effects: (() => unknown)[];
  fetch: Mock;
  file: File | null;
};

type NewResourceFormComponent = (props: { actorId: string }) => ReactNode;

const defaultFields: Record<string, string> = {
  title: "Example script",
  slug: "example-script",
  shortDescription: "Summary",
  description: "A detailed resource description.",
  type: "script",
  tags: "lua",
  mtaMinVersion: "1.6.0",
  dependencies: "",
  version: "1.0.0",
  releaseNotes: "Original notes",
};

/** Mutable form field values read by FakeFormData during submit. */
export const fields: Record<string, string> = { ...defaultFields };

export const reply = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

export class FakeFormData {
  private values = new Map<string, unknown>();
  constructor(form?: unknown, file: File | null = null) {
    if (form) {
      for (const [key, value] of Object.entries(fields)) this.values.set(key, value);
      this.values.set("file", file);
    }
  }
  get(name: string) {
    return this.values.get(name) ?? null;
  }
  set(name: string, value: unknown) {
    this.values.set(name, value);
  }
}

/** Shared react mock factory for new-resource submission suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: NewResourceSubmissionHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots))
        harness.slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        harness.slots[index],
        (value: unknown) => {
          harness.slots[index] =
            typeof value === "function"
              ? (value as (current: unknown) => unknown)(harness.slots[index])
              : value;
        },
      ];
    },
    useRef: (value: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = { current: value };
      return harness.slots[index];
    },
    useEffect: (effect: () => unknown) => {
      harness.effects.push(effect);
    },
  });
}

export function createNewResourceSubmissionInteractionHelpers(
  harness: NewResourceSubmissionHarness,
  NewResourceForm: NewResourceFormComponent,
) {
  function render() {
    harness.cursor = 0;
    harness.effects = [];
    return flattenReactTestTree(NewResourceForm({ actorId: "usr_a" }) as ReactNode);
  }

  async function mount() {
    harness.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_a" } }));
    render();
    for (const effect of harness.effects) effect();
    await vi.waitFor(() =>
      expect(render().find((node) => node.type === "form")?.props.hidden).toBe(false),
    );
  }

  async function submit() {
    const form = render().find((node) => node.type === "form");
    if (!form) throw Error("Missing form");
    await (form.props.onSubmit as (event: unknown) => Promise<void>)({
      preventDefault() {},
      currentTarget: {},
    });
  }

  beforeEach(() => {
    harness.slots = [];
    harness.effects = [];
    harness.fetch.mockReset();
    harness.file = new File(["print('original')"], "resource.lua");
    Object.assign(fields, defaultFields);
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal(
      "FormData",
      class extends FakeFormData {
        constructor(form?: unknown) {
          super(form, harness.file);
        }
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  return { render, mount, submit };
}
