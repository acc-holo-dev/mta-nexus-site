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

const { render, mount, prepare, submit } = createCommercialPlanActorRecoveryInteractionHelpers(
  h,
  CommercialPlanForm,
);

it("ignores a late response after the form actor changes", async () => {
  await mount();
  prepare();
  let complete!: (value: Response) => void;
  h.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  const pending = submit();
  h.actor = "usr_b";
  expect(render().some((n) => n.type === "form")).toBe(false);
  complete(reply({ actorId: "usr_a", plan: {} }));
  await pending;
  expect(h.push).not.toHaveBeenCalled();
  expect(h.refresh).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("nexus:commercial-plan-intent:v1:usr_a:new")).not.toBeNull();
});
