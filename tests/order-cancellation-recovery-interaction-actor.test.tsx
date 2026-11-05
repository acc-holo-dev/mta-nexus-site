import { expect, it, vi } from "vitest";
import {
  createOrderCancellationRecoveryInteractionHelpers,
  mockReactHooks,
  reply,
} from "./helpers/order-cancellation-recovery-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  actor: "usr_a",
  canCancel: true,
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { OrderCancellationForm } from "../apps/web/src/components/order-cancellation-form";

const { render, mount, prepare, submit } = createOrderCancellationRecoveryInteractionHelpers(
  h,
  OrderCancellationForm,
);

it("ignores a late receipt and hides the old reason after the actor changes", async () => {
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
  expect(render().find((n) => n.type === "textarea")?.props.value).toBe("");
  complete(reply({ actorId: "usr_a" }));
  await pending;
  expect(h.refresh).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("nexus:order-cancel:v1:usr_a:ord_a")).not.toBeNull();
});

it("does not reveal an earlier actor's pending reason to a new actor", async () => {
  await mount();
  prepare();
  h.fetch.mockRejectedValueOnce(Error("lost"));
  await submit();
  h.actor = "usr_b";
  h.slots = [];
  await mount();
  expect(render().find((n) => n.type === "textarea")?.props.value).toBe("");
  expect(sessionStorage.getItem("nexus:order-cancel:v1:usr_a:ord_a")).not.toBeNull();
});
