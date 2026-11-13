import { expect, it, vi } from "vitest";
import {
  createCommunityTopicIntentInteractionHelpers,
  fields,
  mockReactHooks,
  response,
} from "../helpers/community-topic-intent-interaction-harness";
import { findTestButton } from "../helpers/flatten-react-test-tree";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effect: null as null | (() => undefined | (() => void)),
  fetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: harness.push, refresh: harness.refresh }),
}));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../site/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: harness.locale, dictionary: getDictionary(harness.locale) }),
  };
});

import { CommunityTopicForm } from "../../site/src/components/community-topic-form";
import { readCommunityTopicIntent } from "../../site/src/lib/community-topic-intent";
import { getDictionary } from "../../site/src/lib/i18n";

const { render, mount, submit } = createCommunityTopicIntentInteractionHelpers(
  harness,
  CommunityTopicForm,
  getDictionary,
);

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
