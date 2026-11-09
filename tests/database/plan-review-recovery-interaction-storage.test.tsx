import { expect, it, vi } from "vitest";
import {
  createPlanReviewRecoveryInteractionHelpers,
  mockReactHooks,
  reply,
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

it("does not submit without recoverable storage and unlocks after a definite first rejection", async () => {
  await mount();
  const original = sessionStorage;
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw Error("denied");
    },
    removeItem: () => {},
  });
  await submit();
  expect(reviewPosts()).toHaveLength(0);
  vi.stubGlobal("sessionStorage", original);
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMIT_EXCEEDED" }, 429));
  await submit();
  expect(sessionStorage.getItem("nexus:plan-review:v1:usr_a:cplan_a")).toBeNull();
  expect(render().find((node) => node.type === "fieldset")?.props.disabled).toBe(false);
});
