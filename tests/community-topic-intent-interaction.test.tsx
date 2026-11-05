import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { findTestButton, flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effect: null as null | (() => undefined | (() => void)),
  fetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
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
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: harness.push, refresh: harness.refresh }),
}));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: harness.locale, dictionary: getDictionary(harness.locale) }),
  };
});

import { CommunityTopicForm } from "../apps/web/src/components/community-topic-form";
import { readCommunityTopicIntent } from "../apps/web/src/lib/community-topic-intent";
import { getDictionary } from "../apps/web/src/lib/i18n";

class FakeInput {
  value = "";
}
class FakeTextarea {
  value = "";
}
class FakeSelect {
  value = "";
}
const fields = {
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
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
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

it.each(["en", "ru"] as const)(
  "keeps the same intent after lost response and a rejected retry in %s",
  async (locale) => {
    harness.locale = locale;
    const copy = getDictionary(locale).community;
    await mount();
    harness.fetch.mockRejectedValueOnce(new Error("response lost"));
    await submit();
    const original = readCommunityTopicIntent("usr_a").intent;
    expect(original).not.toBeNull();
    expect(findTestButton(render(), copy.topicRetry)).toBeDefined();
    harness.fetch.mockResolvedValueOnce(response({ error: "rate limit" }, 429));
    await submit();
    expect(readCommunityTopicIntent("usr_a").intent).toEqual(original);
    expect(harness.fetch.mock.calls[1]?.[1]?.body).toBe(harness.fetch.mock.calls[2]?.[1]?.body);
    harness.slots = [];
    const restored = await mount(true);
    expect(restored.title.value).toBe(fields.title);
    expect(restored.body.value).toBe(fields.body);
    expect(findTestButton(render(), copy.topicRetry)).toBeDefined();
  },
);

it("reuses the same intent even when an older submit handler is invoked again", async () => {
  harness.locale = "en";
  await mount();
  const form = render().find((node) => node.type === "form");
  if (!form) throw Error("Missing topic form");
  const oldSubmit = form.props.onSubmit as (event: unknown) => Promise<void>;
  harness.fetch
    .mockRejectedValueOnce(new Error("response lost"))
    .mockResolvedValueOnce(response({ error: "rate limit" }, 429));
  await oldSubmit({ preventDefault() {}, currentTarget: {} });
  await oldSubmit({ preventDefault() {}, currentTarget: {} });
  expect(harness.fetch.mock.calls[1]?.[1]?.body).toBe(harness.fetch.mock.calls[2]?.[1]?.body);
  expect(readCommunityTopicIntent("usr_a").intent).not.toBeNull();
});

it("does not send a new topic if its intent cannot be stored", async () => {
  harness.locale = "en";
  const copy = getDictionary("en").community;
  await mount();
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw Error("denied");
    },
    removeItem: () => {},
  });
  await submit();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(render().some((node) => node.props.title === copy.topicStorageError)).toBe(true);
});

it("hides the prior actor's draft and retains its intent when the account changes", async () => {
  harness.locale = "en";
  const copy = getDictionary("en").community;
  await mount();
  harness.fetch.mockRejectedValueOnce(new Error("response lost"));
  await submit();
  const original = readCommunityTopicIntent("usr_a").intent;
  harness.fetch.mockResolvedValueOnce(response({ code: "ACTOR_CHANGED" }, 409));
  (findTestButton(render(), copy.topicCheck).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.topicActorChanged)).toBe(true),
  );
  expect(render().find((node) => node.type === "form")?.props.style).toEqual({ display: "none" });
  expect(readCommunityTopicIntent("usr_a").intent).toEqual(original);
});

it("opens the exact saved topic after an owner-scoped recovery check", async () => {
  harness.locale = "en";
  const copy = getDictionary("en").community;
  await mount();
  harness.fetch.mockRejectedValueOnce(new Error("response lost"));
  await submit();
  const pending = readCommunityTopicIntent("usr_a").intent;
  if (!pending) throw Error("Missing intent");
  harness.fetch.mockResolvedValueOnce(
    response({ content: { id: "cnt_a", ...pending.submission, status: "published" } }),
  );
  (findTestButton(render(), copy.topicCheck).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(harness.push).toHaveBeenCalledWith(`/articles/${pending.submission.slug}`),
  );
  expect(harness.fetch).toHaveBeenCalledTimes(3);
});

it("does not accept a different saved topic as confirmation", async () => {
  harness.locale = "en";
  const copy = getDictionary("en").community;
  await mount();
  harness.fetch.mockRejectedValueOnce(new Error("response lost"));
  await submit();
  const pending = readCommunityTopicIntent("usr_a").intent;
  if (!pending) throw Error("Missing intent");
  harness.fetch.mockResolvedValueOnce(
    response({
      content: {
        id: "cnt_a",
        ...pending.submission,
        body: "Different saved body",
        status: "published",
      },
    }),
  );
  (findTestButton(render(), copy.topicCheck).props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.children === copy.topicExisting)).toBe(true),
  );
  expect(harness.push).not.toHaveBeenCalled();
  expect(findTestButton(render(), copy.topicRetry).props.disabled).toBe(true);
  expect(readCommunityTopicIntent("usr_a").intent).toEqual(pending);
});
