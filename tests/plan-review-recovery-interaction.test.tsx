import { createHash } from "node:crypto";
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
  locale: "en" as "en" | "ru",
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
  useNexusLocale: () => ({ locale: h.locale }),
}));

import { commercialFeeEstimate } from "@nexus/domain";
import { PlanReviewForm } from "../apps/web/src/components/plan-review-form";

const terms = {
  titleRu: "Тариф",
  titleEn: "Plan",
  descriptionRu: "Описание тарифа",
  descriptionEn: "Plan description",
  price: 900,
  currency: "USD" as const,
  durationDays: 30 as const,
  commissionBps: 750,
};
const plan = {
  ...terms,
  id: "cplan_a",
  slug: "plan",
  scope: "organization" as const,
  status: "published" as const,
  revision: 2,
};
const scopes = [
  { id: "org_a", name: "Organization A" },
  { id: "org_b", name: "Organization B" },
];
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function render(actorId = "usr_a", revision = 2) {
  h.cursor = 0;
  h.effects = [];
  return flattenReactTestTree(
    PlanReviewForm({ actorId, plan: { ...plan, revision }, scopes }) as ReactNode,
  );
}
async function mount(actorId = "usr_a", currentActor = actorId, revision = 2) {
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: currentActor } }));
  render(actorId, revision);
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(render(actorId, revision).find((node) => node.type === "form")?.props.hidden).toBe(
      false,
    ),
  );
}
async function submit(actorId = "usr_a", revision = 2) {
  const form = render(actorId, revision).find((node) => node.type === "form");
  if (!form) throw Error("Missing review form");
  await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
}
function responseFor(
  command: {
    requestId: string;
    planId: string;
    expectedRevision: number;
    grossAmount: number;
    currency: "USD" | "EUR" | "RUB";
    organizationId?: string;
  },
  actorId = "usr_a",
) {
  return reply({
    review: {
      id: `prev_${createHash("sha256").update(`${actorId}:${command.requestId.toLowerCase()}`).digest("hex")}`,
      planId: command.planId,
      planRevision: command.expectedRevision,
      scope: command.organizationId ? "organization" : "user",
      subjectId: command.organizationId ?? actorId,
      createdAt: "2026-10-11T00:00:00.000Z",
      terms,
      estimate: commercialFeeEstimate(command.grossAmount, command.currency, terms.commissionBps),
    },
    replayed: true,
  });
}
beforeEach(() => {
  h.slots = [];
  h.effects = [];
  h.locale = "en";
  h.fetch.mockReset();
  h.push.mockReset();
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
it("restores the exact review after loss and 429 with its original terms and subject", async () => {
  await mount();
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  await submit();
  const key = "nexus:plan-review:v1:usr_a:cplan_a";
  const saved = sessionStorage.getItem(key);
  expect(saved).toContain('"subjectId":"org_a"');
  const first = h.fetch.mock.calls.find(([url]) => url === "/api/subscriptions/reviews");
  h.slots = [];
  await mount("usr_a", "usr_a", 3);
  const termsNode = render("usr_a", 3).find((node) => typeof node.props.terms === "object");
  expect(termsNode?.props.terms).toMatchObject({ commissionBps: 750 });
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMIT_EXCEEDED" }, 429));
  await submit("usr_a", 3);
  expect(sessionStorage.getItem(key)).toBe(saved);
  const posts = h.fetch.mock.calls.filter(([url]) => url === "/api/subscriptions/reviews");
  expect(posts).toHaveLength(2);
  expect(posts[1]?.[1].body).toBe(first?.[1].body);
  expect(posts[1]?.[1].headers["x-nexus-actor-id"]).toBe("usr_a");
  const command = JSON.parse(String(first?.[1].body));
  h.fetch.mockResolvedValueOnce(responseFor(command));
  await submit("usr_a", 3);
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(h.push).toHaveBeenCalledOnce();
});
it("does not send under a different actor or reveal the saved selection", async () => {
  await mount();
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  await submit();
  const saved = sessionStorage.getItem("nexus:plan-review:v1:usr_a:cplan_a");
  h.slots = [];
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_b" } }));
  render("usr_a");
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(
      render("usr_a").some(
        (node) =>
          typeof node.props.title === "string" && node.props.title.includes("Could not verify"),
      ),
    ).toBe(true),
  );
  expect(render("usr_a").find((node) => node.type === "form")?.props.hidden).toBe(true);
  expect(sessionStorage.getItem("nexus:plan-review:v1:usr_a:cplan_a")).toBe(saved);
});
it("does not submit without recoverable storage and unlocks after a definite first rejection", async () => {
  await mount();
  const original = sessionStorage;
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw Error("denied");
    },
    removeItem: () => {},
  });
  await submit();
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/subscriptions/reviews")).toHaveLength(
    0,
  );
  vi.stubGlobal("sessionStorage", original);
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMIT_EXCEEDED" }, 429));
  await submit();
  expect(sessionStorage.getItem("nexus:plan-review:v1:usr_a:cplan_a")).toBeNull();
  expect(render().find((node) => node.type === "fieldset")?.props.disabled).toBe(false);
});
it("ignores a late response after the form receives another actor", async () => {
  await mount();
  let complete!: (value: Response) => void;
  h.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  const pending = submit();
  await vi.waitFor(() =>
    expect(h.fetch.mock.calls.filter(([url]) => url === "/api/subscriptions/reviews")).toHaveLength(
      1,
    ),
  );
  const post = h.fetch.mock.calls.find(([url]) => url === "/api/subscriptions/reviews");
  const command = JSON.parse(String(post?.[1].body));
  expect(render("usr_b").find((node) => node.type === "form")?.props.hidden).toBe(true);
  complete(responseFor(command));
  await pending;
  expect(h.push).not.toHaveBeenCalled();
  expect(h.refresh).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("nexus:plan-review:v1:usr_a:cplan_a")).not.toBeNull();
});

it.each(["ru", "en"] as const)(
  "shows the original organization when it is absent from the current page in %s",
  async (locale) => {
    await mount();
    h.fetch.mockRejectedValueOnce(new Error("lost"));
    await submit();
    h.slots = [];
    h.locale = locale;
    const original = scopes.splice(0, scopes.length, { id: "org_b", name: "Organization B" });
    try {
      await mount();
      const expected =
        locale === "ru" ? "Исходная организация: org_a" : "Original organization: org_a";
      expect(
        render().some(
          (node) =>
            node.type === "option" &&
            node.props.value === "org_a" &&
            node.props.children === expected,
        ),
      ).toBe(true);
    } finally {
      scopes.splice(0, scopes.length, ...original);
    }
  },
);
