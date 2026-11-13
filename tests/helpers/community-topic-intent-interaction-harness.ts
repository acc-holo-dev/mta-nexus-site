import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { findTestButton, flattenReactTestTree } from "./flatten-react-test-tree";

export type CommunityTopicIntentInteractionHarness = {
  slots: unknown[];
  cursor: number;
  effect: null | (() => undefined | (() => void));
  fetch: Mock;
  push: Mock;
  refresh: Mock;
  locale: "en" | "ru";
};

/** Props match CommunityTopicForm so the real component stays assignable. */
type CommunityTopicFormComponent = (props: { actorId?: string | null }) => ReactNode;

class FakeInput {
  value = "";
}
class FakeTextarea {
  value = "";
}
class FakeSelect {
  value = "";
}

export const fields = {
  title: "Help with setup",
  body: "A detailed question about setup.",
  type: "question",
  tags: "help, lua",
};

class DraftFormData {
  get(name: string) {
    return fields[name as keyof typeof fields] ?? null;
  }
}

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for community-topic intent suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: CommunityTopicIntentInteractionHarness) {
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
    useEffect: (effect: () => undefined | (() => void)) => {
      harness.effect = effect;
    },
    useId: () => "topic-error",
  });
}

export function createCommunityTopicIntentInteractionHelpers(
  harness: CommunityTopicIntentInteractionHarness,
  CommunityTopicForm: CommunityTopicFormComponent,
  getDictionary: typeof import("../../site/src/lib/i18n").getDictionary,
) {
  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(CommunityTopicForm({ actorId: "usr_a" }) as ReactNode);
  }

  function attachForm() {
    const form = render().find((node) => node.type === "form");
    if (!form) throw Error("Missing topic form");
    const values = {
      title: new FakeInput(),
      body: new FakeTextarea(),
      type: new FakeSelect(),
      tags: new FakeInput(),
    };
    (form.props.ref as { current: unknown }).current = {
      elements: { namedItem: (key: string) => values[key as keyof typeof values] },
    };
    return values;
  }

  async function mount(restored = false) {
    harness.fetch.mockResolvedValueOnce(response({ authenticated: true, user: { id: "usr_a" } }));
    const values = attachForm();
    harness.effect?.();
    await vi.waitFor(() =>
      expect(
        findTestButton(
          render(),
          restored
            ? getDictionary(harness.locale).community.topicRetry
            : getDictionary(harness.locale).community.publish,
        ).props.disabled,
      ).toBe(false),
    );
    return values;
  }

  async function submit() {
    const form = render().find((node) => node.type === "form");
    if (!form) throw Error("Missing topic form");
    await (form.props.onSubmit as (event: unknown) => Promise<void>)({
      preventDefault() {},
      currentTarget: {},
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.fetch.mockReset();
    const entries = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
      removeItem: (key: string) => entries.delete(key),
    });
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("FormData", DraftFormData);
    vi.stubGlobal("HTMLInputElement", FakeInput);
    vi.stubGlobal("HTMLTextAreaElement", FakeTextarea);
    vi.stubGlobal("HTMLSelectElement", FakeSelect);
    vi.stubGlobal("crypto", { randomUUID: () => "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" });
  });

  afterEach(() => vi.unstubAllGlobals());

  return { render, mount, submit };
}
