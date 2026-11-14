import { expect, it, vi } from "vitest";
import {
  createSupportActorBindingInteractionHelpers,
  mockReactHooks,
} from "../helpers/support-actor-binding-interaction-harness";

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
vi.mock("../../src/components/locale-context", async () => {
  const { getDictionary } = await import("../../src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});
vi.mock("../../src/lib/support-retry", () => ({
  resolveSupportRetryActorScope: h.scope,
  reserveSupportCaseRetry: h.caseReserve,
  reserveSupportReplyRetry: h.replyReserve,
  clearSupportRetry: h.clear,
}));

import { SupportCaseThread } from "../../src/components/support-case-thread";
import { SupportCenter } from "../../src/components/support-center";

const { fillCaseForm, caseForm, loadOpenThread, fillReply, replyForm } =
  createSupportActorBindingInteractionHelpers(h, SupportCenter, SupportCaseThread);

it("does not create a case when retry storage is unavailable", async () => {
  fillCaseForm();
  h.caseReserve.mockRejectedValueOnce(new Error("Support retry storage unavailable"));
  const form = caseForm();
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(h.caseReserve).toHaveBeenCalled());
  expect(h.fetch).not.toHaveBeenCalled();
});

it("does not send a reply when retry storage is unavailable", async () => {
  await loadOpenThread();
  fillReply();
  h.replyReserve.mockRejectedValueOnce(new Error("Support retry storage unavailable"));
  const form = replyForm();
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(h.replyReserve).toHaveBeenCalled());
  expect(h.fetch).toHaveBeenCalledTimes(1);
});
