import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flattenReactTestTree } from "./helpers/flatten-react-test-tree";
import { terms } from "./subscriptions-fixtures";
const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
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
import { SubscriptionControls } from "../apps/web/src/components/subscription-controls";
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function render(actorId = "usr_a") {
  h.cursor = 0;
  h.effects = [];
  return flattenReactTestTree(
    SubscriptionControls({
      actorId,
      action: "activate",
      planId: "cplan_free",
      planRevision: 2,
      terms,
      scope: "organization",
      scopes: [{ id: "org_a", name: "A" }],
    }) as ReactNode,
  );
}
async function mount(actor = "usr_a") {
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: actor } }));
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(render().find((n) => n.type === "fieldset")?.props.hidden).toBe(false),
  );
}
async function submit() {
  const form = render().find((n) => n.type === "form");
  if (!form) throw new Error("Missing form");
  await (form.props.onSubmit as (e: unknown) => Promise<void>)({
    preventDefault() {},
  });
}
beforeEach(() => {
  h.slots = [];
  h.fetch.mockReset();
  h.push.mockReset();
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal("fetch", h.fetch);
  vi.stubGlobal("window", { dispatchEvent: () => true });
});
afterEach(() => vi.unstubAllGlobals());
it("preserves the same actor, organization, snapshot and request after loss and reload", async () => {
  await mount();
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  await submit();
  const saved = sessionStorage.getItem("nexus:subscription-intent:v1:usr_a");
  expect(saved).toContain('"subjectId":"org_a"');
  const first = h.fetch.mock.calls.find(([url]) => url === "/api/subscriptions/account");
  h.slots = [];
  await mount();
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMIT_EXCEEDED" }, 429));
  await submit();
  const posts = h.fetch.mock.calls.filter(([url]) => url === "/api/subscriptions/account");
  expect(posts).toHaveLength(2);
  expect(posts[1]?.[1].body).toBe(first?.[1].body);
  expect(posts[1]?.[1].headers["x-nexus-actor-id"]).toBe("usr_a");
  expect(sessionStorage.getItem("nexus:subscription-intent:v1:usr_a")).toBe(saved);
});
it("fails closed when storage is unavailable", async () => {
  await mount();
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw Error("denied");
    },
    removeItem: () => {},
  });
  await submit();
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/subscriptions/account")).toHaveLength(
    0,
  );
});
it("hides previous account selection immediately after identity change", async () => {
  await mount();
  expect(render("usr_b").find((n) => n.type === "fieldset")?.props.hidden).toBe(true);
});
it("recovers a lost cancellation on the dashboard without automatically sending it", async () => {
  const cancellation = {
    actorId: "usr_a",
    action: "cancel" as const,
    planId: "cplan_free",
    planRevision: 2,
    terms,
    subscriptionId: "sub_a",
    organizationId: "org_a",
    startedAt: "2026-10-11T20:00:00.000Z",
    expiresAt: "2026-11-10T20:00:00.000Z",
  };
  function cancelRender() {
    h.cursor = 0;
    h.effects = [];
    return flattenReactTestTree(SubscriptionControls(cancellation) as ReactNode);
  }
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_a" } }));
  cancelRender();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(cancelRender().find((n) => n.type === "fieldset")?.props.hidden).toBe(false),
  );
  const checkbox = cancelRender().find((n) => n.type === "input");
  if (!checkbox) throw new Error("Missing cancellation confirmation");
  (checkbox.props.onChange as (event: unknown) => void)({ target: { checked: true } });
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  const form = cancelRender().find((n) => n.type === "form");
  if (!form) throw new Error("Missing form");
  await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  const saved = sessionStorage.getItem("nexus:subscription-intent:v1:usr_a");
  expect(saved).toContain('"subscriptionId":"sub_a"');
  h.slots = [];
  vi.stubGlobal("window", {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  });
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_a" } }));
  const { SubscriptionRecovery } = await import("../apps/web/src/components/subscription-recovery");
  function recoveryRender() {
    h.cursor = 0;
    h.effects = [];
    return flattenReactTestTree(SubscriptionRecovery({ actorId: "usr_a" }) as ReactNode);
  }
  recoveryRender();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(recoveryRender().some((n) => n.type === SubscriptionControls)).toBe(true),
  );
  const recovered = recoveryRender().find((n) => n.type === SubscriptionControls);
  expect(recovered?.props).toMatchObject({
    action: "cancel",
    actorId: "usr_a",
    subscriptionId: "sub_a",
    organizationId: "org_a",
  });
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/subscriptions/account")).toHaveLength(
    1,
  );
});
