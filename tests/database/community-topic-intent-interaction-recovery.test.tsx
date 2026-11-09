import { expect, it, vi } from "vitest";
import {
  createCommunityTopicIntentInteractionHelpers,
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
vi.mock("../../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: harness.locale, dictionary: getDictionary(harness.locale) }),
  };
});

import { CommunityTopicForm } from "../../apps/web/src/components/community-topic-form";
import { readCommunityTopicIntent } from "../../apps/web/src/lib/community-topic-intent";
import { getDictionary } from "../../apps/web/src/lib/i18n";

const { render, mount, submit } = createCommunityTopicIntentInteractionHelpers(
  harness,
  CommunityTopicForm,
  getDictionary,
);

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
