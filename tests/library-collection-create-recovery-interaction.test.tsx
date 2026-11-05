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
  confirm: vi.fn(async () => true),
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
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction: h.confirm }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));

import { LibraryCollectionCommandForm } from "../apps/web/src/components/library-collection-command";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function render(actorId = "usr_a") {
  h.cursor = 0;
  h.effects = [];
  return flattenReactTestTree(LibraryCollectionCommandForm({ locale: "en", actorId }) as ReactNode);
}
async function mount(actorId = "usr_a", currentActor = actorId) {
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: currentActor } }));
  render(actorId);
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(render(actorId).find((node) => node.type === "form")?.props.hidden).toBe(false),
  );
}
function changeName(value: string) {
  const input = render().find((node) => node.type === "input");
  if (!input) throw Error("Missing name");
  (input.props.onChange as (event: unknown) => void)({ target: { value } });
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
  h.push.mockReset();
  h.refresh.mockReset();
  h.confirm.mockReset().mockResolvedValue(true);
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it("retains the original creation after loss, reload and a rate-limited retry", async () => {
  await mount();
  changeName("Private collection");
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  await submit();
  const key = "nexus:collection-create:v1:usr_a";
  const saved = sessionStorage.getItem(key);
  expect(saved).toContain("Private collection");
  const firstPost = h.fetch.mock.calls.find(([url]) => url === "/api/library/collections");
  h.slots = [];
  await mount();
  expect(render().find((node) => node.type === "input")?.props.disabled).toBe(true);
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMITED" }, 429));
  await submit();
  expect(sessionStorage.getItem(key)).toBe(saved);
  const posts = h.fetch.mock.calls.filter(([url]) => url === "/api/library/collections");
  expect(posts).toHaveLength(2);
  expect(posts[1]?.[1].body).toBe(firstPost?.[1].body);
  expect(posts[1]?.[1].headers["x-nexus-actor-id"]).toBe("usr_a");
});
it("does not reveal actor A's draft to a changed account or send under that account", async () => {
  await mount();
  changeName("Private collection");
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  await submit();
  h.slots = [];
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_b" } }));
  render("usr_a");
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(
      render("usr_a").some(
        (node) =>
          typeof node.props.title === "string" && node.props.title.includes("Could not check"),
      ),
    ).toBe(true),
  );
  expect(render("usr_a").find((node) => node.type === "form")?.props.hidden).toBe(true);
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/library/collections")).toHaveLength(1);
  h.slots = [];
  await mount("usr_b");
  expect(render("usr_b").find((node) => node.type === "input")?.props.value).toBe("");
});
it("blocks the first POST when storage fails and unlocks after a definite first rejection", async () => {
  await mount();
  changeName("Private collection");
  const original = sessionStorage;
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw Error("denied");
    },
    removeItem: () => {},
  });
  await submit();
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/library/collections")).toHaveLength(0);
  vi.stubGlobal("sessionStorage", original);
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMITED" }, 429));
  await submit();
  expect(sessionStorage.getItem("nexus:collection-create:v1:usr_a")).toBeNull();
  expect(render().find((node) => node.type === "input")?.props.disabled).toBe(false);
});
it("clears a confirmed creation before navigating", async () => {
  await mount();
  changeName("Private collection");
  h.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => {
    const command = JSON.parse(String(init.body));
    return reply({
      replayed: false,
      receipt: {
        id: "lcr_a",
        requestId: command.requestId,
        command,
        collection: { id: "lcol_a", name: command.name, status: "active", revision: 1 },
        createdAt: "2026-10-11T00:00:00.000Z",
      },
    });
  });
  await submit();
  expect(sessionStorage.getItem("nexus:collection-create:v1:usr_a")).toBeNull();
  expect(h.push).toHaveBeenCalledOnce();
});

const source = { id: "lcol_src", name: "Source", status: "active" as const, revision: 4 };
function renderDuplicate(revision = 4, actorId = "usr_a") {
  h.cursor = 0;
  h.effects = [];
  const collection = { ...source, revision };
  return flattenReactTestTree(
    LibraryCollectionCommandForm({
      locale: "en",
      actorId,
      action: "duplicate",
      collection,
      copyPreview: { source: collection, itemCount: 2, sourceDigest: "a".repeat(64) },
    }) as ReactNode,
  );
}
async function mountDuplicate(revision = 4) {
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_a" } }));
  renderDuplicate(revision);
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(renderDuplicate(revision).find((node) => node.type === "form")?.props.hidden).toBe(
      false,
    ),
  );
}
async function submitDuplicate(revision = 4) {
  const form = renderDuplicate(revision).find((node) => node.type === "form");
  if (!form) throw Error("Missing copy form");
  await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
}
it("recovers the exact duplicate command after loss, reload and source revision change", async () => {
  await mountDuplicate();
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  await submitDuplicate();
  const key = "nexus:collection-duplicate:v1:usr_a:lcol_src";
  const saved = sessionStorage.getItem(key);
  expect(saved).toContain('"expectedRevision":4');
  const original = h.fetch.mock.calls.find(([url]) => url === "/api/library/collections")?.[1].body;
  h.slots = [];
  await mountDuplicate(5);
  expect(
    h.slots.some(
      (value) =>
        typeof value === "object" &&
        value !== null &&
        "current" in value &&
        (value as { current?: { command?: { action?: string } } }).current?.command?.action ===
          "duplicate",
    ),
  ).toBe(true);
  expect(renderDuplicate(5).find((node) => node.type === "input")?.props.disabled).toBe(true);
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMITED" }, 429));
  await submitDuplicate(5);
  expect(sessionStorage.getItem(key)).toBe(saved);
  const posts = h.fetch.mock.calls.filter(([url]) => url === "/api/library/collections");
  expect(posts).toHaveLength(2);
  expect(posts[1]?.[1].body).toBe(original);
});
it("serializes double submission while awaiting copy confirmation", async () => {
  await mountDuplicate();
  let resolveConfirm!: (value: boolean) => void;
  h.confirm.mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      resolveConfirm = resolve;
    }),
  );
  const first = submitDuplicate();
  await submitDuplicate();
  expect(h.confirm).toHaveBeenCalledTimes(1);
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  resolveConfirm(true);
  await first;
  const key = "nexus:collection-duplicate:v1:usr_a:lcol_src";
  const stored = sessionStorage.getItem(key);
  if (!stored) throw Error("Missing copy intent");
  const posts = h.fetch.mock.calls.filter(([url]) => url === "/api/library/collections");
  expect(posts).toHaveLength(1);
  expect(JSON.parse(stored).command).toEqual(JSON.parse(String(posts[0]?.[1].body)));
  h.slots = [];
  await mountDuplicate();
  h.fetch.mockResolvedValueOnce(reply({ code: "RATE_LIMITED" }, 429));
  await submitDuplicate();
  const retries = h.fetch.mock.calls.filter(([url]) => url === "/api/library/collections");
  expect(retries).toHaveLength(2);
  expect(retries[1]?.[1].body).toBe(retries[0]?.[1].body);
});
it("unlocks copy after a cancelled confirmation", async () => {
  await mountDuplicate();
  h.confirm.mockResolvedValueOnce(false);
  await submitDuplicate();
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/library/collections")).toHaveLength(0);
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  await submitDuplicate();
  expect(h.confirm).toHaveBeenCalledTimes(2);
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/library/collections")).toHaveLength(1);
});
it("hides and clears actor A's in-memory draft when the same form receives actor B", async () => {
  await mount();
  changeName("Private collection");
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  await submit();
  const keyA = "nexus:collection-create:v1:usr_a";
  expect(sessionStorage.getItem(keyA)).toContain("Private collection");
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_b" } }));
  expect(render("usr_b").find((node) => node.type === "form")?.props.hidden).toBe(true);
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(render("usr_b").find((node) => node.type === "form")?.props.hidden).toBe(false),
  );
  expect(render("usr_b").find((node) => node.type === "input")?.props.value).toBe("");
  expect(sessionStorage.getItem(keyA)).toContain("Private collection");
});
it("ignores a late actor A success after the same form receives actor B", async () => {
  await mount();
  changeName("Private collection");
  let complete!: (value: Response) => void;
  h.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  const pending = submit();
  await vi.waitFor(() =>
    expect(h.fetch.mock.calls.filter(([url]) => url === "/api/library/collections")).toHaveLength(
      1,
    ),
  );
  const post = h.fetch.mock.calls.find(([url]) => url === "/api/library/collections");
  const command = JSON.parse(String(post?.[1].body));
  expect(render("usr_b").find((node) => node.type === "form")?.props.hidden).toBe(true);
  complete(
    reply({
      replayed: false,
      receipt: {
        id: "lcr_a",
        requestId: command.requestId,
        command,
        collection: { id: "lcol_a", name: command.name, status: "active", revision: 1 },
        createdAt: "2026-10-11T00:00:00.000Z",
      },
    }),
  );
  await pending;
  expect(h.push).not.toHaveBeenCalled();
  expect(h.refresh).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("nexus:collection-create:v1:usr_a")).toContain(
    "Private collection",
  );
});
it("does not display a late actor A error after the form receives actor B", async () => {
  await mount();
  changeName("Private collection");
  let reject!: (reason: Error) => void;
  h.fetch.mockReturnValueOnce(
    new Promise<Response>((_resolve, fail) => {
      reject = fail;
    }),
  );
  const pending = submit();
  await vi.waitFor(() =>
    expect(h.fetch.mock.calls.filter(([url]) => url === "/api/library/collections")).toHaveLength(
      1,
    ),
  );
  expect(render("usr_b").find((node) => node.type === "form")?.props.hidden).toBe(true);
  reject(new Error("old request failed"));
  await pending;
  h.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_b" } }));
  render("usr_b");
  for (const effect of h.effects) effect();
  await vi.waitFor(() =>
    expect(render("usr_b").find((node) => node.type === "form")?.props.hidden).toBe(false),
  );
  expect(
    render("usr_b").some(
      (node) =>
        node.props.title ===
        "The result could not be confirmed. Retry the same operation or reload to check the current state.",
    ),
  ).toBe(false);
});

it("ignores a late confirmation error from actor A after the form receives actor B", async () => {
  await mountDuplicate();
  let reject!: (reason: Error) => void;
  h.confirm.mockReturnValueOnce(
    new Promise<boolean>((_resolve, fail) => {
      reject = fail;
    }),
  );
  const pending = submitDuplicate();
  await vi.waitFor(() => expect(h.confirm).toHaveBeenCalledTimes(1));
  expect(renderDuplicate(4, "usr_b").find((node) => node.type === "form")?.props.hidden).toBe(true);
  reject(new Error("confirmation failed"));
  await pending;
  expect(
    renderDuplicate(4, "usr_b").some(
      (node) =>
        node.props.title ===
        "The result could not be confirmed. Retry the same operation or reload to check the current state.",
    ),
  ).toBe(false);
  expect(h.fetch.mock.calls.filter(([url]) => url === "/api/library/collections")).toHaveLength(0);
});
