import { expect, it, vi } from "vitest";
import {
  createCommercialPlanFormConfirmInteractionHelpers,
  mockReactHooks,
  reply,
} from "./helpers/commercial-plan-form-confirm-interaction-harness";

const draftPlan = {
  id: "cplan_draft",
  slug: "seller-plan",
  scope: "user" as const,
  status: "draft" as const,
  revision: 1,
  titleRu: "Тариф",
  titleEn: "Seller plan",
  descriptionRu: "Описание тарифа",
  descriptionEn: "Seller plan details",
  price: 999,
  currency: "USD" as const,
  durationDays: 30 as const,
  commissionBps: 1000,
};

const archivedPlan = {
  ...draftPlan,
  id: "cplan_archived",
  status: "archived" as const,
  revision: 3,
};

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  actor: "usr_a",
  confirm: vi.fn(async () => true),
}));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction: h.confirm }));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { CommercialPlanForm } from "../apps/web/src/components/commercial-plan-form";

const { mount, fill, clickLifecycle, planPosts } =
  createCommercialPlanFormConfirmInteractionHelpers(h, CommercialPlanForm);

it.each([
  ["Publish", draftPlan],
  ["Archive", draftPlan],
  ["Restore draft", archivedPlan],
] as const)(
  "keeps lifecycle %s from writing when confirmation is cancelled",
  async (label, plan) => {
    await mount("usr_a", plan);
    fill("reason", "Valid reason");
    const before = planPosts().length;
    const key = `nexus:commercial-plan-intent:v1:usr_a:${plan.id}`;
    h.confirm.mockResolvedValueOnce(false);
    await clickLifecycle(label);
    await vi.waitFor(() => expect(h.confirm).toHaveBeenCalled());
    expect(planPosts()).toHaveLength(before);
    expect(sessionStorage.getItem(key)).toBeNull();
  },
);

it("sends archive after confirmation is accepted", async () => {
  await mount("usr_a", draftPlan);
  fill("reason", "Valid reason");
  h.fetch.mockResolvedValueOnce(
    reply({
      actorId: "usr_a",
      plan: { ...draftPlan, status: "archived", revision: 2 },
    }),
  );
  h.confirm.mockResolvedValueOnce(true);
  await clickLifecycle("Archive");
  await vi.waitFor(() => expect(planPosts().length).toBeGreaterThan(0));
  expect(h.confirm).toHaveBeenCalled();
  const [, init] = planPosts().at(-1) as [string, RequestInit];
  expect(JSON.parse(String(init.body))).toMatchObject({
    action: "archive",
    expectedRevision: 1,
  });
});
