import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flattenReactTestTree } from "./helpers/flatten-react-test-tree";
const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  actor: "usr_a",
  canCancel: true,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useId: () => "field",
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = initial;
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
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));
import { OrderCancellationForm } from "../apps/web/src/components/order-cancellation-form";
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function render() {
  h.cursor = 0;
  h.effects = [];
  return flattenReactTestTree(
    OrderCancellationForm({
      actorId: h.actor,
      orderId: "ord_a",
      expectedUpdatedAt: "2026-10-10T12:00:00.000Z",
      canCancel: h.canCancel,
    }) as ReactNode,
  );
}
async function mount() {
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: h.actor } }));
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() => {
    const nodes = render();
    expect(
      nodes.some((n) => n.type === "fieldset" && n.props.disabled === false) ||
        nodes.some(
          (n) =>
            n.type === "button" &&
            n.props.children === "Retry the same request" &&
            n.props.disabled === false,
        ),
    ).toBe(true);
  });
}
function prepare() {
  const reason = render().find((n) => n.type === "textarea");
  if (!reason) throw Error("Missing reason");
  (reason.props.onChange as (e: unknown) => void)({ target: { value: "Not needed" } });
  const check = render().find((n) => n.type === "input" && n.props.type === "checkbox");
  if (!check) throw Error("Missing confirmation");
  (check.props.onChange as (e: unknown) => void)({ target: { checked: true } });
}
async function submit() {
  const form = render().find((n) => n.type === "form");
  if (!form) throw Error("Missing form");
  await (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
}
beforeEach(() => {
  h.slots = [];
  h.actor = "usr_a";
  h.canCancel = true;
  h.fetch.mockReset();
  h.refresh.mockReset();
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
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
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/orders/ord_a/cancel")).toHaveLength(1);
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
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/orders/ord_a/cancel")).toHaveLength(0);
});
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
it("allows correction after a definite first-attempt rejection", async () => {
  await mount();
  prepare();
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMIT_EXCEEDED" }, 429));
  await submit();
  expect(sessionStorage.getItem("nexus:order-cancel:v1:usr_a:ord_a")).toBeNull();
  expect(render().find((n) => n.type === "fieldset")?.props.disabled).toBe(false);
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
it.each(["2026-10-10T12:00:00.000Z", "2026-10-10T11:59:59.999Z"])(
  "keeps the intent when a receipt timestamp is not newer: %s",
  async (cancelledAt) => {
    await mount();
    prepare();
    h.fetch.mockImplementationOnce(async (_url, options) => {
      const command = JSON.parse(options.body);
      return reply({
        actorId: "usr_a",
        kind: "unpaid_order_cancelled",
        orderId: "ord_a",
        requestId: command.requestId,
        cancelledAt,
      });
    });
    await submit();
    expect(sessionStorage.getItem("nexus:order-cancel:v1:usr_a:ord_a")).not.toBeNull();
    expect(h.refresh).not.toHaveBeenCalled();
    expect(
      render().some((n) => n.type === "button" && n.props.children === "Retry the same request"),
    ).toBe(true);
  },
);
