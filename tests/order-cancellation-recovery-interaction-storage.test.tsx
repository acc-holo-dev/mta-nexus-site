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
vi.mock("../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { OrderCancellationForm } from "../site/src/components/order-cancellation-form";

const { render, mount, prepare, submit, cancelPosts } =
  createOrderCancellationRecoveryInteractionHelpers(h, OrderCancellationForm);

it("fails closed if the retry intent cannot be saved", async () => {
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
  expect(cancelPosts()).toHaveLength(0);
});

it("allows correction after a definite first-attempt rejection", async () => {
  await mount();
  prepare();
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMIT_EXCEEDED" }, 429));
  await submit();
  expect(sessionStorage.getItem("nexus:order-cancel:v1:usr_a:ord_a")).toBeNull();
  expect(render().find((n) => n.type === "fieldset")?.props.disabled).toBe(false);
});
