import { expect, it, vi } from "vitest";
import {
  createSubscriptionIntentInteractionHelpers,
  mockReactHooks,
  reply,
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
vi.mock("../../src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { SubscriptionControls } from "../../src/components/subscription-controls";

const { mount, submit, accountPosts } = createSubscriptionIntentInteractionHelpers(
  h,
  SubscriptionControls,
);

it("preserves the same actor, organization, snapshot and request after loss and reload", async () => {
  await mount();
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  await submit();
  const saved = sessionStorage.getItem("nexus:subscription-intent:v1:usr_a");
  expect(saved).toContain('"subjectId":"org_a"');
  const first = h.fetch.mock.calls.find(([url]) => url === "/api/subscriptions/account");
  h.slots = [];
  await mount();
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMIT_EXCEEDED" }, 429));
  await submit();
  const posts = accountPosts();
  expect(posts).toHaveLength(2);
  expect(posts[1]?.[1].body).toBe(first?.[1].body);
  expect(posts[1]?.[1].headers["x-nexus-actor-id"]).toBe("usr_a");
  expect(sessionStorage.getItem("nexus:subscription-intent:v1:usr_a")).toBe(saved);
});
