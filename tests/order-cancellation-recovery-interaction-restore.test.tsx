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

const { mount, prepare, submit, cancelPosts } = createOrderCancellationRecoveryInteractionHelpers(
  h,
  OrderCancellationForm,
);

it("retains the exact cancellation after loss, reload with canCancel false, and 429", async () => {
  await mount();
  prepare();
  h.fetch.mockRejectedValueOnce(Error("lost"));
  await submit();
  const key = "nexus:order-cancel:v1:usr_a:ord_a",
    saved = sessionStorage.getItem(key);
  const first = h.fetch.mock.calls[1][1];
  expect(first.headers["x-nexus-actor-id"]).toBe("usr_a");
  h.slots = [];
  h.canCancel = false;
  await mount();
  expect(cancelPosts()).toHaveLength(1);
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMIT_EXCEEDED" }, 429));
  await submit();
  expect(sessionStorage.getItem(key)).toBe(saved);
  expect(h.fetch.mock.calls.at(-1)?.[1].body).toBe(first.body);
  const command = JSON.parse(first.body);
  h.fetch.mockResolvedValueOnce(
    reply({
      actorId: "usr_a",
      kind: "unpaid_order_cancelled",
      orderId: "ord_a",
      requestId: command.requestId,
      cancelledAt: "2026-10-10T12:00:01.000Z",
    }),
  );
  await submit();
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(h.refresh).toHaveBeenCalledOnce();
});
