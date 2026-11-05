import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flattenReactTestTree } from "./helpers/flatten-react-test-tree";

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
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial;
    return [
      h.slots[i],
      (value: unknown) => {
        h.slots[i] = typeof value === "function" ? value(h.slots[i]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = { current: initial };
    return h.slots[i];
  },
  useEffect: (effect: () => unknown) => {
    h.effects.push(effect);
  },
  useCallback: (callback: unknown) => {
    h.cursor++;
    return callback;
  },
}));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});
vi.mock("../apps/web/src/lib/support-retry", () => ({
  resolveSupportRetryActorScope: h.scope,
  reserveSupportCaseRetry: h.caseReserve,
  reserveSupportReplyRetry: h.replyReserve,
  clearSupportRetry: h.clear,
}));

import { SupportCaseThread } from "../apps/web/src/components/support-case-thread";
import { SupportCenter } from "../apps/web/src/components/support-center";

function render() {
  h.cursor = 0;
  h.effects = [];
  return flattenReactTestTree(SupportCenter({ actorId: "usr_a" }) as ReactNode);
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
beforeEach(() => {
  h.slots = [];
  h.effects = [];
  h.fetch.mockReset();
  h.clear.mockReset();
  h.scope.mockReset().mockResolvedValue("b".repeat(64));
  h.caseReserve.mockClear();
  h.replyReserve.mockClear();
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it("sends the displayed actor precondition even when the retry identity has changed", async () => {
  const nodes = render();
  const subject = nodes.find(
    (node) => typeof node.props.label === "string" && node.props.minLength === 5,
  );
  const message = nodes.find((node) => node.type === "textarea");
  if (!subject || !message) throw Error("Missing support fields");
  (subject.props.onChange as (event: unknown) => void)({ target: { value: "Private question" } });
  (message.props.onChange as (event: unknown) => void)({
    target: { value: "Private support details" },
  });
  h.fetch.mockResolvedValueOnce(reply({ code: "ACTOR_CHANGED" }, 409));
  const form = render().find((node) => typeof node.props.onSubmit === "function");
  if (!form) throw Error("Missing support form");
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

const caseId = `sup_${"a".repeat(24)}`;
function renderThread() {
  h.cursor = 0;
  h.effects = [];
  return flattenReactTestTree(SupportCaseThread({ actorId: "usr_a", caseId }) as ReactNode);
}
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
it("keeps the original reply key after response loss and an actor change", async () => {
  const timestamp = "2026-10-08T05:00:00.000Z";
  h.fetch.mockResolvedValueOnce(
    reply({
      actorId: "usr_a",
      supportCase: {
        id: caseId,
        category: "account",
        subject: "Help",
        status: "open",
        updatedAt: timestamp,
      },
      messages: [],
      messagePage: 1,
      messageTotalPages: 1,
      messageTotal: 0,
      requester: true,
      staff: false,
    }),
  );
  renderThread();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(renderThread().find((node) => node.type === "textarea")).toBeDefined(),
  );
  const text = renderThread().find((node) => node.type === "textarea");
  if (!text) throw Error("Missing reply");
  (text.props.onChange as (event: unknown) => void)({
    target: { value: "Original private reply" },
  });
  const form = renderThread().find((node) => typeof node.props.onSubmit === "function");
  if (!form) throw Error("Missing reply form");
  h.fetch.mockRejectedValueOnce(new Error("lost response"));
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(2));
  await vi.waitFor(() =>
    expect(renderThread().find((node) => node.type === "textarea")?.props.disabled).toBe(false),
  );
  h.fetch.mockResolvedValueOnce(reply({ code: "ACTOR_CHANGED" }, 409));
  const retryForm = renderThread().find((node) => typeof node.props.onSubmit === "function");
  if (!retryForm) throw Error("Missing retry form");
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
  const nodes = render();
  const subject = nodes.find(
    (node) => typeof node.props.label === "string" && node.props.minLength === 5,
  );
  const message = nodes.find((node) => node.type === "textarea");
  if (!subject || !message) throw Error("Missing support fields");
  (subject.props.onChange as (event: unknown) => void)({ target: { value: "Private question" } });
  (message.props.onChange as (event: unknown) => void)({
    target: { value: "Private support details" },
  });
  const form = render().find((node) => typeof node.props.onSubmit === "function");
  if (!form) throw Error("Missing support form");
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
  const timestamp = "2026-10-08T05:00:00.000Z";
  h.fetch.mockResolvedValueOnce(
    reply({
      actorId: "usr_a",
      supportCase: {
        id: caseId,
        category: "account",
        subject: "Help",
        status: "open",
        updatedAt: timestamp,
      },
      messages: [],
      messagePage: 1,
      messageTotalPages: 1,
      messageTotal: 0,
      requester: true,
      staff: false,
    }),
  );
  renderThread();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(renderThread().find((node) => node.type === "textarea")).toBeDefined(),
  );
  const text = renderThread().find((node) => node.type === "textarea");
  if (!text) throw Error("Missing reply");
  (text.props.onChange as (event: unknown) => void)({
    target: { value: "Original private reply" },
  });
  const form = renderThread().find((node) => typeof node.props.onSubmit === "function");
  if (!form) throw Error("Missing reply form");
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
it("does not create a case when retry storage is unavailable", async () => {
  const nodes = render();
  const subject = nodes.find(
    (node) => typeof node.props.label === "string" && node.props.minLength === 5,
  );
  const message = nodes.find((node) => node.type === "textarea");
  if (!subject || !message) throw Error("Missing support fields");
  (subject.props.onChange as (event: unknown) => void)({ target: { value: "Private question" } });
  (message.props.onChange as (event: unknown) => void)({
    target: { value: "Private support details" },
  });
  h.caseReserve.mockRejectedValueOnce(new Error("Support retry storage unavailable"));
  const form = render().find((node) => typeof node.props.onSubmit === "function");
  if (!form) throw Error("Missing support form");
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(h.caseReserve).toHaveBeenCalled());
  expect(h.fetch).not.toHaveBeenCalled();
});
it("does not send a reply when retry storage is unavailable", async () => {
  const timestamp = "2026-10-08T05:00:00.000Z";
  h.fetch.mockResolvedValueOnce(
    reply({
      actorId: "usr_a",
      supportCase: {
        id: caseId,
        category: "account",
        subject: "Help",
        status: "open",
        updatedAt: timestamp,
      },
      messages: [],
      messagePage: 1,
      messageTotalPages: 1,
      messageTotal: 0,
      requester: true,
      staff: false,
    }),
  );
  renderThread();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(renderThread().find((node) => node.type === "textarea")).toBeDefined(),
  );
  const text = renderThread().find((node) => node.type === "textarea");
  if (!text) throw Error("Missing reply");
  (text.props.onChange as (event: unknown) => void)({
    target: { value: "Original private reply" },
  });
  h.replyReserve.mockRejectedValueOnce(new Error("Support retry storage unavailable"));
  const form = renderThread().find((node) => typeof node.props.onSubmit === "function");
  if (!form) throw Error("Missing reply form");
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(h.replyReserve).toHaveBeenCalled());
  expect(h.fetch).toHaveBeenCalledTimes(1);
});
