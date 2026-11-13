import { expect, it, vi } from "vitest";
import {
  createSubscriptionIntentInteractionHelpers,
  mockReactHooks,
} from "../helpers/subscription-intent-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock("../../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { SubscriptionControls } from "../../site/src/components/subscription-controls";

const { mount, submit, accountPosts } = createSubscriptionIntentInteractionHelpers(
  h,
  SubscriptionControls,
);

it("fails closed when storage is unavailable", async () => {
  await mount();
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw Error("denied");
    },
    removeItem: () => {},
  });
  await submit();
  expect(accountPosts()).toHaveLength(0);
});
