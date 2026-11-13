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
