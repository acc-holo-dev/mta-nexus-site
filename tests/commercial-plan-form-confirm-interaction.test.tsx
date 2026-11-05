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

it("keeps the recovery marker when confirmation to clear it is cancelled", async () => {
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
  const plansBefore = h.fetch.mock.calls.filter(
    ([url]) => url === "/api/admin/commerce/plans",
  ).length;
  confirm.mockResolvedValueOnce(false);
  (clear.props.onClick as () => void)();
  await vi.waitFor(() => expect(confirm).toHaveBeenCalled());
  expect(sessionStorage.getItem(key)).toBe(saved);
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/admin/commerce/plans")).toHaveLength(
    plansBefore,
  );
});

it("clears the recovery marker only after confirmation is accepted", async () => {
  await mount();
  prepare();
  h.fetch.mockRejectedValueOnce(Error("lost"));
  await submit();
  const key = "nexus:commercial-plan-intent:v1:usr_a:new";
  expect(sessionStorage.getItem(key)).not.toBeNull();
  h.slots = [];
  await mount();
  const clear = render().find(
    (n) => n.type === "button" && n.props.children === "I checked the result",
  );
  if (!clear) throw Error("Missing acknowledgement");
  confirm.mockResolvedValueOnce(true);
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_a" } }));
  (clear.props.onClick as () => void)();
  await vi.waitFor(() => expect(sessionStorage.getItem(key)).toBeNull());
  expect(confirm).toHaveBeenCalledOnce();
});
