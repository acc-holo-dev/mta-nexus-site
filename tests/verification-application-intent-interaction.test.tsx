import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { findTestButton, flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  request: vi.fn(),
  fetch: vi.fn(),
  actor: "usr_a",
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots))
      h.slots[i] = typeof initial === "function" ? (initial as () => unknown)() : initial;
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
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../apps/web/src/lib/user-platform-client", async (original) => ({
  ...(await original<typeof import("../apps/web/src/lib/user-platform-client")>()),
  platformRequest: h.request,
}));

import { VerificationWorkspace } from "../apps/web/src/components/verification-workspace";
import { PlatformRequestError } from "../apps/web/src/lib/user-platform-client";
import { verificationCopy } from "../apps/web/src/lib/verification-workspace-copy";

const filters = { page: 1, view: "pending" as const, type: undefined, query: "" };
const overview = {
  profile: {
    id: "usr_a",
    username: "author",
    name: "Author",
    role: "user",
    identityVerified: false,
    experienceVerified: false,
    hasSpecialties: false,
    identityPending: false,
    experiencePending: false,
  },
  history: { items: [], page: 1, view: "pending" as const, hasMore: false },
};
const teams = {
  items: [{ id: "org_1", name: "Team", slug: "team", verified: false, pending: false }],
  page: 1,
  hasMore: false,
};
function render() {
  h.cursor = 0;
  h.effects = [];
  return flattenReactTestTree(
    VerificationWorkspace({
      actorId: h.actor,
      initial: overview,
      initialTeams: teams,
      filters,
      teamFilters: filters,
      locale: "en",
    }) as ReactNode,
  );
}
function runEffects() {
  render();
  for (const effect of h.effects) effect();
}
async function submit() {
  const form = render().find((n) => n.type === "form" && n.props.onSubmit);
  if (!form) throw new Error("Missing form");
  await (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
}
beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  h.effects = [];
  h.actor = "usr_a";
  h.request.mockReset();
  h.fetch.mockReset();
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  });
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it("keeps an unknown application unchanged after reload and pending duplicate", async () => {
  h.fetch.mockImplementation(
    async () => new Response(JSON.stringify({ authenticated: true, user: { id: h.actor } })),
  );
  runEffects();
  await vi.waitFor(() =>
    expect(findTestButton(render(), verificationCopy("en").choose).props.disabled).toBe(false),
  );
  (findTestButton(render(), verificationCopy("en").choose).props.onClick as () => void)();
  let nodes = render();
  const proof = nodes.find((n) => n.type === "input" && n.props.type === "url");
  if (!proof) throw Error("missing proof");
  (proof.props.onChange as (e: unknown) => void)({
    target: { value: "https://example.test/evidence" },
  });
  nodes = render();
  const notes = nodes.find((n) => n.type === "textarea");
  if (!notes) throw Error("missing notes");
  (notes.props.onChange as (e: unknown) => void)({
    target: { value: "Original private evidence" },
  });
  h.request.mockRejectedValueOnce(new Error("lost response"));
  await submit();
  const slot = "nexus:verification-application:v1:usr_a";
  expect(sessionStorage.getItem(slot)).toContain("Original private evidence");
  h.slots = [];
  runEffects();
  await vi.waitFor(() =>
    expect(render().find((n) => n.type === "textarea")?.props.value).toBe(
      "Original private evidence",
    ),
  );
  h.request.mockRejectedValueOnce(new PlatformRequestError("Rate limit", "RATE_LIMIT_EXCEEDED"));
  await submit();
  expect(h.request).toHaveBeenCalledTimes(2);
  expect(h.request.mock.calls[1][3]).toEqual(h.request.mock.calls[0][3]);
  expect(sessionStorage.getItem(slot)).not.toBeNull();
  h.request.mockRejectedValueOnce(new PlatformRequestError("Pending", "VERIFICATION_PENDING"));
  await submit();
  expect(h.request).toHaveBeenCalledTimes(3);
  expect(sessionStorage.getItem(slot)).not.toBeNull();
});
it("does not start submission when recovery storage is unavailable", async () => {
  h.fetch.mockImplementation(
    async () => new Response(JSON.stringify({ authenticated: true, user: { id: h.actor } })),
  );
  vi.stubGlobal("sessionStorage", {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {},
  });
  runEffects();
  await vi.waitFor(() =>
    expect(findTestButton(render(), verificationCopy("en").choose).props.disabled).toBe(true),
  );
  (findTestButton(render(), verificationCopy("en").choose).props.onClick as () => void)();
  expect(h.request).not.toHaveBeenCalled();
  expect(render().find((n) => n.type === "textarea")).toBeUndefined();
});
it("does not show actor A draft when switched to B", async () => {
  sessionStorage.setItem(
    "nexus:verification-application:v1:usr_a",
    JSON.stringify({
      actorId: "usr_a",
      targetName: "Team",
      request: {
        targetType: "organization",
        targetId: "org_1",
        proofUrl: "https://example.test/evidence",
        notes: "Private evidence A",
      },
    }),
  );
  h.fetch.mockImplementation(
    async () => new Response(JSON.stringify({ authenticated: true, user: { id: h.actor } })),
  );
  runEffects();
  await vi.waitFor(() =>
    expect(render().find((n) => n.type === "textarea")?.props.value).toBe("Private evidence A"),
  );
  h.actor = "usr_b";
  expect(render().find((n) => n.type === "textarea")).toBeUndefined();
});
it("unlocks a first submission when the target already has a pending application", async () => {
  h.fetch.mockImplementation(
    async () => new Response(JSON.stringify({ authenticated: true, user: { id: h.actor } })),
  );
  runEffects();
  await vi.waitFor(() =>
    expect(findTestButton(render(), verificationCopy("en").choose).props.disabled).toBe(false),
  );
  (findTestButton(render(), verificationCopy("en").choose).props.onClick as () => void)();
  let nodes = render();
  const proof = nodes.find((n) => n.type === "input" && n.props.type === "url");
  if (!proof) throw Error("missing proof");
  (proof.props.onChange as (e: unknown) => void)({
    target: { value: "https://example.test/evidence" },
  });
  nodes = render();
  const notes = nodes.find((n) => n.type === "textarea");
  if (!notes) throw Error("missing notes");
  (notes.props.onChange as (e: unknown) => void)({
    target: { value: "Original private evidence" },
  });
  h.request.mockRejectedValueOnce(new PlatformRequestError("Pending", "VERIFICATION_PENDING"));
  await submit();
  expect(sessionStorage.getItem("nexus:verification-application:v1:usr_a")).toBeNull();
  expect(findTestButton(render(), verificationCopy("en").choose).props.disabled).toBe(false);
});
