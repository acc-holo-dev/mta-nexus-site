import { expect, it, vi } from "vitest";
import { getDictionary } from "../../src/lib/i18n";
import {
  createCommercialPlanActorRecoveryInteractionHelpers,
  mockReactHooks,
} from "../helpers/commercial-plan-actor-recovery-interaction-harness";

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
vi.mock("../../src/features/shell/confirm-action", () => ({ confirmAction: h.confirm }));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock("../../src/features/shell/locale", () => ({
  useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }),
}));

import { CommercialPlanForm } from "../../src/features/commerce/commercial-plans";

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
