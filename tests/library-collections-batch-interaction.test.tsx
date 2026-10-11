import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = initial;
    return [
      h.slots[i],
      (v: unknown) => {
        h.slots[i] = typeof v === "function" ? (v as (p: unknown) => unknown)(h.slots[i]) : v;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = { current: initial };
    return h.slots[i];
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
import { LibraryCollectionBatchForm } from "../apps/web/src/components/library-collection-batch";
type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const e = node as Element;
  return [e, ...nodes(e.props.children as ReactNode)];
}
const collection = { id: "lcol_a", name: "Core", status: "active" as const, revision: 4 },
  items = [
    { productId: "prd_b", title: "Second", hasAccess: true },
    { productId: "prd_a", title: null, hasAccess: false },
  ];
function render(action: "add-many" | "remove-many" = "remove-many", entries = items) {
  h.cursor = 0;
  return nodes(LibraryCollectionBatchForm({ locale: "en", collection, action, items: entries }));
}
function check(
  index: number,
  checked = true,
  action: "add-many" | "remove-many" = "remove-many",
  entries = items,
) {
  const input = render(action, entries).filter((n) => n.type === "input")[index];
  if (!input) throw new Error("Missing checkbox");
  (input.props.onChange as (e: unknown) => void)({ target: { checked } });
}
function submit(tree = render()) {
  const form = tree.find((n) => n.type === "form");
  if (!form) throw new Error("Missing form");
  return (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
}
function success(command: unknown, snapshot = { ...collection, revision: 5 }) {
  return {
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
  };
}
beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it("requires explicit acknowledgement and clears it whenever selection changes", async () => {
  check(0);
  await submit();
  expect(h.fetch).not.toHaveBeenCalled();
  check(2);
  check(1);
  await submit();
  expect(h.fetch).not.toHaveBeenCalled();
  expect(render().find((n) => n.type === "button")?.props.disabled).toBe(true);
});
it("removes unavailable references with a frozen exact retry after response loss", async () => {
  check(1);
  check(2);
  h.fetch.mockRejectedValueOnce(new Error("timeout"));
  await submit();
  const initial = h.fetch.mock.calls[0]?.[1] as RequestInit,
    command = JSON.parse(String(initial.body));
  expect(command).toMatchObject({
    action: "remove-many",
    productIds: ["prd_a"],
    expectedRevision: 4,
  });
  expect(render().find((n) => n.type === "fieldset")?.props.disabled).toBe(true);
  expect(h.refresh).not.toHaveBeenCalled();
  h.fetch.mockResolvedValueOnce(success(command));
  await submit();
  expect(h.fetch.mock.calls[1]?.[1].body).toBe(initial.body);
  expect(h.refresh).toHaveBeenCalledOnce();
  await submit();
  expect(h.fetch).toHaveBeenCalledTimes(2);
});
it("does not refresh on an acknowledgement with changed batch references", async () => {
  check(0);
  check(2);
  h.fetch.mockImplementationOnce(async (_: string, init: RequestInit) =>
    success({ ...JSON.parse(String(init.body)), productIds: ["prd_other"] }),
  );
  await submit();
  expect(h.refresh).not.toHaveBeenCalled();
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
});
it("coalesces simultaneous submissions into one canonical batch request", async () => {
  check(0);
  check(1);
  check(2);
  let finish: (v: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tree = render(),
    running = submit(tree);
  await submit(tree);
  expect(h.fetch).toHaveBeenCalledOnce();
  const command = JSON.parse(String(h.fetch.mock.calls[0]?.[1].body));
  expect(command.productIds).toEqual(["prd_a", "prd_b"]);
  finish(success(command));
  await running;
  expect(h.refresh).toHaveBeenCalledOnce();
});
it("blocks add selection without access but allows its removal", () => {
  expect(render("add-many").filter((n) => n.type === "input")[1]?.props.disabled).toBe(true);
  expect(render().filter((n) => n.type === "input")[1]?.props.disabled).toBe(false);
});
it("caps selected references at twenty and permits deselecting a selected reference", () => {
  const entries = Array.from({ length: 21 }, (_, i) => ({
    productId: `prd_${i}`,
    title: `Resource ${i}`,
    hasAccess: true,
  }));
  for (let i = 0; i < 20; i++) check(i, true, "remove-many", entries);
  const inputs = render("remove-many", entries).filter((n) => n.type === "input");
  expect(inputs[20]?.props.disabled).toBe(true);
  expect(inputs[0]?.props.disabled).toBe(false);
  check(0, false, "remove-many", entries);
  expect(render("remove-many", entries).filter((n) => n.type === "input")[20]?.props.disabled).toBe(
    false,
  );
});
