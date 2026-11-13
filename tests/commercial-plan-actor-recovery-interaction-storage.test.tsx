import { expect, it, vi } from "vitest";
import {
  createCommercialPlanActorRecoveryInteractionHelpers,
  mockReactHooks,
} from "./helpers/commercial-plan-actor-recovery-interaction-harness";

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
vi.mock("../site/src/components/confirm-action", () => ({ confirmAction: h.confirm }));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock("../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { CommercialPlanForm } from "../site/src/components/commercial-plan-form";

const { mount, prepare, submit, planPosts } = createCommercialPlanActorRecoveryInteractionHelpers(
  h,
  CommercialPlanForm,
);

it("does not send a create without durable marker storage", async () => {
  await mount();
  prepare();
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw Error("denied");
    },
    removeItem: () => {},
  });
  await submit();
  expect(planPosts()).toHaveLength(0);
});
