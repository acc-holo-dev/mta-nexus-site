import { expect, it, vi } from "vitest";
import {
  createPlanReviewRecoveryInteractionHelpers,
  mockReactHooks,
  reply,
  responseFor,
} from "../helpers/plan-review-recovery-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock("../../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: h.locale }),
}));

import { PlanReviewForm } from "../../apps/web/src/components/plan-review-form";

const { render, mount, submit, reviewPosts } = createPlanReviewRecoveryInteractionHelpers(
  h,
  PlanReviewForm,
);

it("restores the exact review after loss and 429 with its original terms and subject", async () => {
  await mount();
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  await submit();
  const key = "nexus:plan-review:v1:usr_a:cplan_a";
  const saved = sessionStorage.getItem(key);
  expect(saved).toContain('"subjectId":"org_a"');
  const first = h.fetch.mock.calls.find(([url]) => url === "/api/subscriptions/reviews");
  h.slots = [];
  await mount("usr_a", "usr_a", 3);
  const termsNode = render("usr_a", 3).find((node) => typeof node.props.terms === "object");
  expect(termsNode?.props.terms).toMatchObject({ commissionBps: 750 });
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMIT_EXCEEDED" }, 429));
  await submit("usr_a", 3);
  expect(sessionStorage.getItem(key)).toBe(saved);
  const posts = reviewPosts();
  expect(posts).toHaveLength(2);
  expect(posts[1]?.[1].body).toBe(first?.[1].body);
  expect(posts[1]?.[1].headers["x-nexus-actor-id"]).toBe("usr_a");
  const command = JSON.parse(String(first?.[1].body));
  h.fetch.mockResolvedValueOnce(responseFor(command));
  await submit("usr_a", 3);
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(h.push).toHaveBeenCalledOnce();
});
