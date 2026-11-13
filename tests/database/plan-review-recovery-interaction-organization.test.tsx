import { expect, it, vi } from "vitest";
import {
  createPlanReviewRecoveryInteractionHelpers,
  mockReactHooks,
  scopes,
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
vi.mock("../../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: h.locale }),
}));

import { PlanReviewForm } from "../../site/src/components/plan-review-form";

const { render, mount, submit } = createPlanReviewRecoveryInteractionHelpers(h, PlanReviewForm);

it.each(["ru", "en"] as const)(
  "shows the original organization when it is absent from the current page in %s",
  async (locale) => {
    await mount();
    h.fetch.mockRejectedValueOnce(new Error("lost"));
    await submit();
    h.slots = [];
    h.locale = locale;
    const original = scopes.splice(0, scopes.length, { id: "org_b", name: "Organization B" });
    try {
      await mount();
      const expected =
        locale === "ru" ? "Исходная организация: org_a" : "Original organization: org_a";
      expect(
        render().some(
          (node) =>
            node.type === "option" &&
            node.props.value === "org_a" &&
            node.props.children === expected,
        ),
      ).toBe(true);
    } finally {
      scopes.splice(0, scopes.length, ...original);
    }
  },
);
