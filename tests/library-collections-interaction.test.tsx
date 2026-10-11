import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useId: () => "field",
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = initial;
    return [
      h.slots[i],
      (v: unknown) => {
        h.slots[i] = v;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = { current: initial };
    return h.slots[i];
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh, push: h.push }) }));

import { LibraryCollectionCommandForm } from "../apps/web/src/components/library-collection-command";

type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const e = node as Element;
  return [e, ...nodes(e.props.children as ReactNode)];
}
const collection = { id: "lcol_a", name: "Core", status: "active" as const, revision: 4 };
const render = (
  action: "create" | "archive" | "remove" | "duplicate" = "remove",
  preview = { source: collection, itemCount: 200, sourceDigest: "a".repeat(64) },
) => {
  h.cursor = 0;
  return nodes(
    LibraryCollectionCommandForm({
      locale: "en",
      action,
      ...(action === "create" ? {} : { collection }),
      productId: "prd_a",
      ...(action === "duplicate" ? { copyPreview: preview } : {}),
    }),
  );
};
const submit = (tree: Element[]) => {
  const form = tree.find((n) => n.type === "form");
  if (!form) throw new Error("Missing command form");
  return (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
};
const success = (command: unknown, snapshot: unknown) => ({
  ok: true,
  json: async () => ({
    replayed: false,
    receipt: {
      id: "lcr_a",
      requestId: (command as { requestId: string }).requestId,
      command,
      collection: snapshot,
      createdAt: "2026-10-11T00:00:00.000Z",
    },
  }),
});
beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it("retries the same UUID and exact command after an ambiguous timeout", async () => {
  h.fetch.mockRejectedValueOnce(new Error("timeout"));
  await submit(render());
  const first = h.fetch.mock.calls[0]?.[1] as RequestInit,
    command = JSON.parse(String(first.body));
  expect(h.refresh).not.toHaveBeenCalled();
  expect(h.push).not.toHaveBeenCalled();
  h.fetch.mockResolvedValueOnce(success(command, { ...collection, revision: 5 }));
  await submit(render());
  expect(h.fetch.mock.calls[1]?.[1].body).toBe(first.body);
  expect(h.refresh).toHaveBeenCalledOnce();
});
it("does not mark success or navigate on a mismatched confirmation", async () => {
  h.fetch.mockImplementationOnce(async (_: string, init: RequestInit) =>
    success(JSON.parse(String(init.body)), { ...collection, id: "lcol_other", revision: 5 }),
  );
  await submit(render());
  expect(h.refresh).not.toHaveBeenCalled();
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
});
it("requires archive acknowledgement before submitting", async () => {
  await submit(render("archive"));
  expect(h.fetch).not.toHaveBeenCalled();
  const checkbox = render("archive").find((n) => n.type === "input" && n.props.type === "checkbox");
  if (!checkbox) throw new Error("Missing archive confirmation");
  (checkbox.props.onChange as (e: unknown) => void)({ target: { checked: true } });
  h.fetch.mockImplementationOnce(async (_: string, init: RequestInit) =>
    success(JSON.parse(String(init.body)), { ...collection, status: "archived", revision: 5 }),
  );
  await submit(render("archive"));
  expect(h.refresh).toHaveBeenCalledOnce();
});
it("prevents rapid double submission and never retries a confirmed command", async () => {
  let resolve: (v: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const tree = render(),
    pending = submit(tree);
  await submit(tree);
  expect(h.fetch).toHaveBeenCalledOnce();
  const command = JSON.parse(String(h.fetch.mock.calls[0]?.[1].body));
  resolve(success(command, { ...collection, revision: 5 }));
  await pending;
  await submit(render());
  expect(h.fetch).toHaveBeenCalledOnce();
});
it("confirms a full source copy and retries exactly before navigating to its new collection", async () => {
  await submit(render("duplicate"));
  expect(h.fetch).not.toHaveBeenCalled();
  const checkbox = render("duplicate").find(
    (n) => n.type === "input" && n.props.type === "checkbox",
  );
  if (!checkbox) throw new Error("Missing copy confirmation");
  (checkbox.props.onChange as (e: unknown) => void)({ target: { checked: true } });
  h.fetch.mockRejectedValueOnce(new Error("response lost"));
  await submit(render("duplicate"));
  expect(h.fetch.mock.calls[0]?.[0]).toBe("/api/library/collections");
  const init = h.fetch.mock.calls[0]?.[1] as RequestInit,
    command = JSON.parse(String(init.body));
  expect(command).toMatchObject({
    action: "duplicate",
    name: "Core",
    sourceCollectionId: collection.id,
    expectedRevision: 4,
    expectedItemCount: 200,
    sourceDigest: "a".repeat(64),
  });
  expect(h.push).not.toHaveBeenCalled();
  h.fetch.mockResolvedValueOnce(
    success(command, { id: "lcol_copy", name: "Core", status: "active", revision: 1 }),
  );
  await submit(render("duplicate"));
  expect(h.fetch.mock.calls[1]?.[1].body).toBe(init.body);
  expect(h.push).toHaveBeenCalledWith("/workspace/library/collections/lcol_copy");
  expect(h.refresh).toHaveBeenCalledOnce();
});
it("rejects a source/preview mismatch before a copy request", async () => {
  const preview = {
    source: { ...collection, id: "lcol_other" },
    itemCount: 2,
    sourceDigest: "a".repeat(64),
  };
  const checkbox = render("duplicate", preview).find(
    (n) => n.type === "input" && n.props.type === "checkbox",
  );
  if (!checkbox) throw new Error("Missing confirmation");
  (checkbox.props.onChange as (e: unknown) => void)({ target: { checked: true } });
  await submit(render("duplicate", preview));
  expect(h.fetch).not.toHaveBeenCalled();
});
it("does not navigate on a copy acknowledgement naming the source as its target", async () => {
  const checkbox = render("duplicate").find(
    (n) => n.type === "input" && n.props.type === "checkbox",
  );
  if (!checkbox) throw new Error("Missing confirmation");
  (checkbox.props.onChange as (e: unknown) => void)({ target: { checked: true } });
  h.fetch.mockImplementationOnce(async (_: string, init: RequestInit) =>
    success(JSON.parse(String(init.body)), { ...collection, revision: 1 }),
  );
  await submit(render("duplicate"));
  expect(h.push).not.toHaveBeenCalled();
  expect(h.refresh).not.toHaveBeenCalled();
});
