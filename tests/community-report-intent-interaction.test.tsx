import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
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
  useRef: (value: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = { current: value };
    return h.slots[i];
  },
  useEffect: (effect: () => unknown) => {
    h.effects.push(effect);
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/articles/topic" }));
vi.mock("next/link", () => ({ default: ({ children }: { children: ReactNode }) => children }));

import { CommunityReportForm } from "../apps/web/src/components/community-report-form";

function render(actorId = "usr_a") {
  h.cursor = 0;
  h.effects = [];
  return flattenReactTestTree(
    CommunityReportForm({
      targetType: "comment",
      targetId: "cmt_a",
      locale: "en",
      actorId,
    }) as ReactNode,
  );
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
async function mount() {
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_a" } }));
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalled());
  await vi.waitFor(() =>
    expect(render().find((node) => node.props.onClick)?.props.onClick).toBeDefined(),
  );
  const open = render().find((node) => node.props.onClick);
  if (!open) throw Error("Missing report button");
  (open.props.onClick as () => void)();
  await vi.waitFor(() => expect(render().find((node) => node.type === "form")).toBeDefined());
}
async function submit() {
  const form = render().find((node) => node.type === "form");
  if (!form) throw Error("Missing form");
  await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
}
beforeEach(() => {
  h.slots = [];
  h.effects = [];
  h.fetch.mockReset();
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it("keeps the original report after a lost response and a rate-limited retry", async () => {
  await mount();
  const form = render().find((node) => node.type === "form");
  expect(form).toBeTruthy();
  const reason = render().find((node) => node.type === "textarea");
  if (!reason) throw Error("Missing reason");
  (reason.props.onChange as (event: unknown) => void)({
    target: { value: "Original report reason" },
  });
  h.fetch.mockRejectedValueOnce(new Error("response lost"));
  await submit();
  const key = "nexus:report-intent:v1:usr_a:comment:cmt_a";
  const saved = sessionStorage.getItem(key);
  expect(saved).toContain("Original report reason");
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMITED" }, 429));
  await submit();
  expect(sessionStorage.getItem(key)).toBe(saved);
  const posts = h.fetch.mock.calls.filter(([path]) => path === "/api/workspace/reports");
  expect(posts).toHaveLength(2);
  expect(posts[1]?.[1].body).toBe(posts[0]?.[1].body);
  expect(posts[1]?.[1].headers["x-nexus-actor-id"]).toBe("usr_a");
});
it("hides the form if the account changed before restoring", async () => {
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_b" } }));
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalled());
  const open = render().find((node) => node.props.onClick);
  if (!open) throw Error("Missing report button");
  (open.props.onClick as () => void)();
  await vi.waitFor(() => expect(render().find((node) => node.type === "form")).toBeUndefined());
});
it("does not send when the pending intent cannot be stored", async () => {
  await mount();
  const reason = render().find((node) => node.type === "textarea");
  if (!reason) throw Error("Missing reason");
  (reason.props.onChange as (event: unknown) => void)({
    target: { value: "Original report reason" },
  });
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw new Error("denied");
    },
    removeItem: () => {},
  });
  await submit();
  expect(h.fetch.mock.calls.filter(([path]) => path === "/api/workspace/reports")).toHaveLength(0);
});

it("hides and clears the old actor's pending report when the actor changes", async () => {
  await mount();
  const reason = render().find((node) => node.type === "textarea");
  if (!reason) throw Error("Missing reason");
  (reason.props.onChange as (event: unknown) => void)({
    target: { value: "Private reason for actor A" },
  });
  h.fetch.mockRejectedValueOnce(new Error("response lost"));
  await submit();
  expect(sessionStorage.getItem("nexus:report-intent:v1:usr_a:comment:cmt_a")).toContain(
    "Private reason for actor A",
  );
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_b" } }));
  expect(render("usr_b").find((node) => node.type === "form")).toBeUndefined();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(render("usr_b").find((node) => node.type === "form")).toBeDefined(),
  );
  const nextReason = render("usr_b").find((node) => node.type === "textarea");
  expect(nextReason?.props.value).toBe("");
  expect(sessionStorage.getItem("nexus:report-intent:v1:usr_b:comment:cmt_a")).toBeNull();
  expect(sessionStorage.getItem("nexus:report-intent:v1:usr_a:comment:cmt_a")).toContain(
    "Private reason for actor A",
  );
});

it("unlocks the report when the first attempt is definitely rejected", async () => {
  await mount();
  const reason = render().find((node) => node.type === "textarea");
  if (!reason) throw Error("Missing reason");
  (reason.props.onChange as (event: unknown) => void)({
    target: { value: "Original report reason" },
  });
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMITED" }, 429));
  await submit();
  expect(sessionStorage.getItem("nexus:report-intent:v1:usr_a:comment:cmt_a")).toBeNull();
  expect(render().find((node) => node.type === "textarea")?.props.disabled).toBe(false);
});
