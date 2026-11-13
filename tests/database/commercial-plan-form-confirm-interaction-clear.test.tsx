import { expect, it, vi } from "vitest";
import {
  createCommercialPlanFormConfirmInteractionHelpers,
  mockReactHooks,
  reply,
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
vi.mock("../../site/src/components/confirm-action", () => ({ confirmAction: h.confirm }));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock("../../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { CommercialPlanForm } from "../../site/src/components/commercial-plan-form";

const { mount, prepare, submit, acknowledgementButton } =
  createCommercialPlanFormConfirmInteractionHelpers(h, CommercialPlanForm);

it("clears the recovery marker only after confirmation is accepted", async () => {
  await mount();
  prepare();
  h.fetch.mockRejectedValueOnce(Error("lost"));
  await submit();
  const key = "nexus:commercial-plan-intent:v1:usr_a:new";
  expect(sessionStorage.getItem(key)).not.toBeNull();
  h.slots = [];
  await mount();
  const clear = acknowledgementButton();
  if (!clear) throw Error("Missing acknowledgement");
  h.confirm.mockResolvedValueOnce(true);
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_a" } }));
  (clear.props.onClick as () => void)();
  await vi.waitFor(() => expect(sessionStorage.getItem(key)).toBeNull());
  expect(h.confirm).toHaveBeenCalledOnce();
});
