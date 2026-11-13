import { expect, it, vi } from "vitest";
import {
  createCommunityTopicIntentInteractionHelpers,
  mockReactHooks,
} from "../helpers/community-topic-intent-interaction-harness";

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
vi.mock("../../src/components/locale-context", async () => {
  const { getDictionary } = await import("../../src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: harness.locale, dictionary: getDictionary(harness.locale) }),
  };
});

import { CommunityTopicForm } from "../../src/components/community-topic-form";
import { getDictionary } from "../../src/lib/i18n";

const { render, mount, submit } = createCommunityTopicIntentInteractionHelpers(
  harness,
  CommunityTopicForm,
  getDictionary,
);

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
