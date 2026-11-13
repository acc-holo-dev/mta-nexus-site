import { expect, it, vi } from "vitest";
import {
  createSupportActorBindingInteractionHelpers,
  mockReactHooks,
  reply,
} from "./helpers/support-actor-binding-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  clear: vi.fn(),
  scope: vi.fn(),
  caseReserve: vi.fn(async (payload: string) => ({
    key: "12345678-1234-4234-8234-123456789abc",
    payload,
    recovered: false,
  })),
  replyReserve: vi.fn(async (_caseId: string, body: string, status: string) => ({
    key: "12345678-1234-4234-8234-123456789abc",
    payload: JSON.stringify({ message: body, expectedStatus: status }),
    recovered: true,
  })),
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../site/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});
vi.mock("../site/src/lib/support-retry", () => ({
  resolveSupportRetryActorScope: h.scope,
  reserveSupportCaseRetry: h.caseReserve,
  reserveSupportReplyRetry: h.replyReserve,
  clearSupportRetry: h.clear,
}));

import { SupportCaseThread } from "../site/src/components/support-case-thread";
import { SupportCenter } from "../site/src/components/support-center";

const { render, renderThread, fillCaseForm, caseForm, loadOpenThread, fillReply, replyForm } =
  createSupportActorBindingInteractionHelpers(h, SupportCenter, SupportCaseThread);

it("keeps the original reply key after response loss and an actor change", async () => {
  await loadOpenThread();
  fillReply();
  const form = replyForm();
  h.fetch.mockRejectedValueOnce(new Error("lost response"));
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(2));
  await vi.waitFor(() =>
    expect(renderThread().find((node) => node.type === "textarea")?.props.disabled).toBe(false),
  );
  h.fetch.mockResolvedValueOnce(reply({ code: "ACTOR_CHANGED" }, 409));
  const retryForm = replyForm();
  (retryForm.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(3));
  await vi.waitFor(() =>
    expect(renderThread().find((node) => node.type === "textarea")?.props.disabled).toBe(false),
  );
  expect(h.clear).not.toHaveBeenCalled();
  expect(h.fetch.mock.calls[1]?.[1].headers["Idempotency-Key"]).toBe(
    h.fetch.mock.calls[2]?.[1].headers["Idempotency-Key"],
  );
});

it("does not reserve or send a new case key while the actor scope is unknown", async () => {
  fillCaseForm();
  const form = caseForm();
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(1));
  await vi.waitFor(() =>
    expect(render().find((node) => node.type === "textarea")?.props.disabled).toBe(false),
  );
  h.scope.mockResolvedValueOnce(null);
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(h.scope).toHaveBeenCalledTimes(2));
  await vi.waitFor(() =>
    expect(render().find((node) => node.type === "textarea")?.props.disabled).toBe(false),
  );
  expect(h.fetch).toHaveBeenCalledTimes(1);
  expect(h.caseReserve).toHaveBeenCalledTimes(1);
  h.fetch.mockResolvedValueOnce(reply({ code: "ACTOR_CHANGED" }, 409));
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(2));
  expect(h.fetch.mock.calls[0]?.[1].headers["Idempotency-Key"]).toBe(
    h.fetch.mock.calls[1]?.[1].headers["Idempotency-Key"],
  );
});

it("does not reserve or send a new reply key while the actor scope is unknown", async () => {
  await loadOpenThread();
  fillReply();
  const form = replyForm();
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(2));
  await vi.waitFor(() =>
    expect(renderThread().find((node) => node.type === "textarea")?.props.disabled).toBe(false),
  );
  h.scope.mockResolvedValueOnce(null);
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(h.scope).toHaveBeenCalledTimes(2));
  await vi.waitFor(() =>
    expect(renderThread().find((node) => node.type === "textarea")?.props.disabled).toBe(false),
  );
  expect(h.fetch).toHaveBeenCalledTimes(2);
  expect(h.replyReserve).toHaveBeenCalledTimes(1);
  expect(h.clear).not.toHaveBeenCalled();
  h.fetch.mockResolvedValueOnce(reply({ code: "ACTOR_CHANGED" }, 409));
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(3));
  expect(h.fetch.mock.calls[1]?.[1].headers["Idempotency-Key"]).toBe(
    h.fetch.mock.calls[2]?.[1].headers["Idempotency-Key"],
  );
});
