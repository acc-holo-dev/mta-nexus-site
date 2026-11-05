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
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction: h.confirm }));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { CommercialPlanForm } from "../apps/web/src/components/commercial-plan-form";

const { mount, prepare, submit, planPosts, acknowledgementButton } =
  createCommercialPlanActorRecoveryInteractionHelpers(h, CommercialPlanForm);

it("keeps the recovery marker when acknowledgement confirmation is cancelled", async () => {
  await mount();
  prepare();
  h.fetch.mockRejectedValueOnce(Error("lost"));
  await submit();
  const key = "nexus:commercial-plan-intent:v1:usr_a:new";
  const saved = sessionStorage.getItem(key);
  expect(saved).not.toBeNull();
  h.slots = [];
  await mount();
  const clear = acknowledgementButton();
  if (!clear) throw Error("Missing acknowledgement");
  const fetchBefore = h.fetch.mock.calls.length;
  const plansBefore = planPosts().length;
  h.confirm.mockResolvedValueOnce(false);
  (clear.props.onClick as () => void)();
  await vi.waitFor(() => expect(h.confirm).toHaveBeenCalledTimes(1));
  expect(h.confirm).toHaveBeenCalledWith({
    title: "The operation result is unknown",
    object: "seller-plan",
    consequences:
      "Check the list and history first. Clearing this warning does not confirm the result and may allow a duplicate operation.",
    confirmLabel: "I checked the result",
    cancelLabel: "Cancel",
    closeLabel: "Cancel",
    danger: true,
  });
  expect(sessionStorage.getItem(key)).toBe(saved);
  expect(h.fetch.mock.calls).toHaveLength(fetchBefore);
  expect(planPosts()).toHaveLength(plansBefore);
});
