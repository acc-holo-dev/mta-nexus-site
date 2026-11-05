import { expect, it, vi } from "vitest";
import {
  createCommercialPlanActorRecoveryInteractionHelpers,
  mockReactHooks,
  reply,
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
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction: h.confirm }));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { CommercialPlanForm } from "../apps/web/src/components/commercial-plan-form";

const { mount, prepare, submit, planPosts, acknowledgementButton } =
  createCommercialPlanActorRecoveryInteractionHelpers(h, CommercialPlanForm);

it("retains an actor-scoped marker across a lost create and reload until explicit review", async () => {
  await mount();
  prepare();
  h.fetch.mockRejectedValueOnce(Error("lost"));
  await submit();
  const key = "nexus:commercial-plan-intent:v1:usr_a:new";
  const saved = sessionStorage.getItem(key);
  expect(saved).toContain('"slug":"seller-plan"');
  expect(saved).not.toContain("Seller plan details");
  expect(h.fetch.mock.calls[1][1].headers["x-nexus-actor-id"]).toBe("usr_a");
  h.slots = [];
  await mount();
  await submit();
  expect(planPosts()).toHaveLength(1);
  expect(sessionStorage.getItem(key)).toBe(saved);
  const clear = acknowledgementButton();
  if (!clear) throw Error("Missing acknowledgement");
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_a" } }));
  (clear.props.onClick as () => void)();
  await vi.waitFor(() => expect(sessionStorage.getItem(key)).toBeNull());
  expect(h.confirm).toHaveBeenCalledOnce();
  expect(planPosts()).toHaveLength(1);
});
