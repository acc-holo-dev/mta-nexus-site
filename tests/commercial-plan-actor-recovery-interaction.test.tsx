import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  actor: "usr_a",
}));
const confirm = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction: confirm }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useId: () => "field",
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
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));

import { CommercialPlanForm } from "../apps/web/src/components/commercial-plan-form";

const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
function render() {
  h.cursor = 0;
  h.effects = [];
  return flattenReactTestTree(CommercialPlanForm({ actorId: h.actor }) as ReactNode);
}
async function mount(actor = h.actor) {
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: actor } }));
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() => expect(render().some((n) => n.type === "form")).toBe(true));
}
function fill(id: string, value: string) {
  const field = render().find((n) => n.props.id === `field-${id}`);
  if (!field) throw Error(`Missing ${id}`);
  (field.props.onChange as (event: unknown) => void)({ target: { value } });
}
function prepare() {
  fill("slug", "seller-plan");
  fill("titleRu", "Тариф");
  fill("titleEn", "Seller plan");
  fill("descriptionRu", "Описание тарифа");
  fill("descriptionEn", "Seller plan details");
  fill("reason", "Valid reason");
}
async function submit() {
  const form = render().find((n) => n.type === "form");
  if (!form) throw Error("Missing form");
  await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
}
beforeEach(() => {
  h.slots = [];
  h.actor = "usr_a";
  h.fetch.mockReset();
  h.push.mockReset();
  h.refresh.mockReset();
  confirm.mockResolvedValue(true);
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it("retains an actor-scoped marker across a lost create and reload until explicit review", async () => {
  await mount();
  prepare();
  h.fetch.mockRejectedValueOnce(Error("lost"));
  await submit();
  const key = "nexus:commercial-plan-intent:v1:usr_a:new";
  const saved = sessionStorage.getItem(key);
  expect(saved).toContain('"slug":"seller-plan"');
  expect(saved).not.toContain("Seller plan details");
  expect(h.fetch.mock.calls[1][1].headers["x-nexus-actor-id"]).toBe("usr_a");
  h.slots = [];
  await mount();
  await submit();
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/admin/commerce/plans")).toHaveLength(1);
  expect(sessionStorage.getItem(key)).toBe(saved);
  const clear = render().find(
    (n) => n.type === "button" && n.props.children === "I checked the result",
  );
  if (!clear) throw Error("Missing acknowledgement");
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_a" } }));
  (clear.props.onClick as () => void)();
  await vi.waitFor(() => expect(sessionStorage.getItem(key)).toBeNull());
  expect(confirm).toHaveBeenCalledOnce();
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/admin/commerce/plans")).toHaveLength(1);
});
it("keeps the recovery marker when acknowledgement confirmation is cancelled", async () => {
  await mount();
  prepare();
  h.fetch.mockRejectedValueOnce(Error("lost"));
  await submit();
  const key = "nexus:commercial-plan-intent:v1:usr_a:new";
  const saved = sessionStorage.getItem(key);
  expect(saved).not.toBeNull();
  h.slots = [];
  await mount();
  const clear = render().find(
    (n) => n.type === "button" && n.props.children === "I checked the result",
  );
  if (!clear) throw Error("Missing acknowledgement");
  const fetchBefore = h.fetch.mock.calls.length;
  const plansBefore = h.fetch.mock.calls.filter(
    ([url]) => url === "/api/admin/commerce/plans",
  ).length;
  confirm.mockResolvedValueOnce(false);
  (clear.props.onClick as () => void)();
  await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  expect(confirm).toHaveBeenCalledWith({
    title: "The operation result is unknown",
    object: "seller-plan",
    consequences:
      "Check the list and history first. Clearing this warning does not confirm the result and may allow a duplicate operation.",
    confirmLabel: "I checked the result",
    cancelLabel: "Cancel",
    closeLabel: "Cancel",
    danger: true,
  });
  expect(sessionStorage.getItem(key)).toBe(saved);
  expect(h.fetch.mock.calls).toHaveLength(fetchBefore);
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/admin/commerce/plans")).toHaveLength(
    plansBefore,
  );
});
it("does not send a create without durable marker storage", async () => {
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
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/admin/commerce/plans")).toHaveLength(0);
});
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
