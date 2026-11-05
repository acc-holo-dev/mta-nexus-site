import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { findTestButton, flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  request: vi.fn(),
  fetch: vi.fn(),
  push: vi.fn(),
  actor: "usr_a",
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../apps/web/src/lib/organization-workspace-client", () => ({
  organizationRequest: h.request,
}));

import { OrganizationProfileForm } from "../apps/web/src/components/organization-profile-form";

function render() {
  h.cursor = 0;
  h.effects = [];
  return flattenReactTestTree(
    OrganizationProfileForm({ locale: "en", actorId: h.actor }) as ReactNode,
  );
}
async function submit() {
  const form = render().find((node) => node.type === "form");
  if (!form) throw new Error("Missing form");
  await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
}
beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  h.effects = [];
  h.request.mockReset();
  h.fetch.mockReset();
  h.push.mockReset();
  h.actor = "usr_a";
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  });
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it("locks an unknown creation outcome across reload and does not retry after inconclusive recovery", async () => {
  h.fetch.mockImplementation(
    async () => new Response(JSON.stringify({ authenticated: true, user: { id: "usr_a" } })),
  );
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(render().find((n) => n.props.id === "organization-name")).toBeDefined(),
  );
  let nodes = render();
  const name = nodes.find((n) => n.props.id === "organization-name");
  if (!name) throw new Error("Missing name");
  (name.props.onChange as (e: unknown) => void)({
    target: { value: "My organization" },
  });
  nodes = render();
  const slug = nodes.find((n) => n.props.id === "organization-slug");
  if (!slug) throw new Error("Missing slug");
  (slug.props.onChange as (e: unknown) => void)({
    target: { value: "my-organization" },
  });
  h.request.mockRejectedValueOnce(new Error("lost response"));
  await submit();
  expect(sessionStorage.getItem("nexus:organization-create:v1:usr_a")).toContain("my-organization");
  expect(h.request).toHaveBeenCalledTimes(1);
  h.slots = [];
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() => expect(findTestButton(render(), "Check result")).toBeDefined());
  const retry = findTestButton(render(), "Check result");
  h.request.mockResolvedValueOnce({ organization: null });
  await (retry.props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(h.request).toHaveBeenCalledTimes(2));
  await submit();
  expect(h.request).toHaveBeenCalledTimes(2);
  expect(sessionStorage.getItem("nexus:organization-create:v1:usr_a")).not.toBeNull();
});
it("hides prior actor fields immediately when the mounted form receives another actor", async () => {
  h.fetch.mockImplementation(
    async () => new Response(JSON.stringify({ authenticated: true, user: { id: h.actor } })),
  );
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(render().find((n) => n.props.id === "organization-name")).toBeDefined(),
  );
  const name = render().find((n) => n.props.id === "organization-name");
  if (!name) throw new Error("Missing name");
  (name.props.onChange as (e: unknown) => void)({ target: { value: "Private draft A" } });
  h.actor = "usr_b";
  expect(render().find((n) => n.props.id === "organization-name")).toBeUndefined();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(render().find((n) => n.props.id === "organization-name")).toBeDefined(),
  );
  expect(render().find((n) => n.props.id === "organization-name")?.props.value).toBe("");
});
it("clears the recovered intent before SPA navigation without pagehide", async () => {
  sessionStorage.setItem(
    "nexus:organization-create:v1:usr_a",
    JSON.stringify({
      actorId: "usr_a",
      nonce: "a".repeat(32),
      fields: {
        name: "My organization",
        slug: "my-organization",
        description: "",
        logoUrl: "",
        websiteUrl: "",
      },
    }),
  );
  h.fetch.mockImplementation(
    async () => new Response(JSON.stringify({ authenticated: true, user: { id: "usr_a" } })),
  );
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() => expect(findTestButton(render(), "Check result")).toBeDefined());
  h.request.mockResolvedValueOnce({ organization: { id: "org_1" } });
  (findTestButton(render(), "Check result").props.onClick as () => void)();
  await vi.waitFor(() => expect(h.push).toHaveBeenCalledWith("/workspace/organizations/org_1"));
  expect(sessionStorage.getItem("nexus:organization-create:v1:usr_a")).toBeNull();
});
it("unlocks a first request rejected before creation", async () => {
  const { PlatformRequestError } = await import("../apps/web/src/lib/user-platform-client");
  h.fetch.mockImplementation(
    async () => new Response(JSON.stringify({ authenticated: true, user: { id: "usr_a" } })),
  );
  render();
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(render().find((n) => n.props.id === "organization-name")).toBeDefined(),
  );
  let nodes = render();
  const name = nodes.find((n) => n.props.id === "organization-name");
  if (!name) throw new Error("Missing name");
  (name.props.onChange as (e: unknown) => void)({ target: { value: "My organization" } });
  nodes = render();
  const slug = nodes.find((n) => n.props.id === "organization-slug");
  if (!slug) throw new Error("Missing slug");
  (slug.props.onChange as (e: unknown) => void)({ target: { value: "my-organization" } });
  h.request.mockRejectedValueOnce(
    new PlatformRequestError("Too many requests", "RATE_LIMIT_EXCEEDED"),
  );
  await submit();
  expect(sessionStorage.getItem("nexus:organization-create:v1:usr_a")).toBeNull();
  expect(render().some((n) => n.type === "button" && n.props.children === "Check result")).toBe(
    false,
  );
});
