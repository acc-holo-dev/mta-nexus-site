import { expect, it, vi } from "vitest";
import {
  createSupportActorBindingInteractionHelpers,
  mockReactHooks,
  reply,
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
vi.mock("../../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../apps/web/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});
vi.mock("../../apps/web/src/lib/support-retry", () => ({
  resolveSupportRetryActorScope: h.scope,
  reserveSupportCaseRetry: h.caseReserve,
  reserveSupportReplyRetry: h.replyReserve,
  clearSupportRetry: h.clear,
}));

import { SupportCaseThread } from "../../apps/web/src/components/support-case-thread";
import { SupportCenter } from "../../apps/web/src/components/support-center";

const { render, renderThread, fillCaseForm, caseForm } =
  createSupportActorBindingInteractionHelpers(h, SupportCenter, SupportCaseThread);

it("sends the displayed actor precondition even when the retry identity has changed", async () => {
  fillCaseForm();
  h.fetch.mockResolvedValueOnce(reply({ code: "ACTOR_CHANGED" }, 409));
  const form = caseForm();
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalled());
  expect(h.fetch.mock.calls[0]?.[0]).toBe("/api/support");
  expect(h.fetch.mock.calls[0]?.[1].headers["x-nexus-actor-id"]).toBe("usr_a");
  expect(h.fetch.mock.calls[0]?.[1].body).toContain("Private support details");
});

it("does not publish a different actor's support list in the old page", async () => {
  h.fetch.mockResolvedValueOnce(
    reply({ actorId: "usr_b", cases: [], page: 1, total: 0, totalPages: 1 }),
  );
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalled());
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === "Could not load support cases.")).toBe(
      true,
    ),
  );
});

it("shows not-found for a 404 thread response without an actor id", async () => {
  h.fetch.mockResolvedValueOnce(reply({ error: "Not found" }, 404));
  renderThread();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(renderThread().some((node) => node.props.title === "Support case is unavailable.")).toBe(
      true,
    ),
  );
});
