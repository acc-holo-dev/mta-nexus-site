import { expect, it, vi } from "vitest";
import {
  createCommercialPlanFormConfirmInteractionHelpers,
  mockReactHooks,
} from "../helpers/commercial-plan-form-confirm-interaction-harness";

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
vi.mock("../../apps/web/src/components/confirm-action", () => ({ confirmAction: h.confirm }));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock("../../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { CommercialPlanForm } from "../../apps/web/src/components/commercial-plan-form";

const { mount, prepare, submit, planPosts, acknowledgementButton } =
  createCommercialPlanFormConfirmInteractionHelpers(h, CommercialPlanForm);

it("keeps the recovery marker when confirmation to clear it is cancelled", async () => {
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
  const plansBefore = planPosts().length;
  h.confirm.mockResolvedValueOnce(false);
  (clear.props.onClick as () => void)();
  await vi.waitFor(() => expect(h.confirm).toHaveBeenCalled());
  expect(sessionStorage.getItem(key)).toBe(saved);
  expect(planPosts()).toHaveLength(plansBefore);
});
