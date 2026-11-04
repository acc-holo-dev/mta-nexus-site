import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionItemCopyInteractionHelpers,
  mockReactHooks,
} from "./helpers/library-collection-item-copy-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  cleanup: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { LibraryCollectionItemCopyForm } from "../apps/web/src/components/library-collection-item-copy";
import { libraryCollectionsCopy } from "../apps/web/src/lib/library-collections-i18n";

const { state, firstDestination, render, choose, check, submit, reviewed, success } =
  createLibraryCollectionItemCopyInteractionHelpers(harness, LibraryCollectionItemCopyForm);

it.each(["en", "ru"] as const)(
  "requires reviewed selections and retains both collection revisions after response loss in %s",
  async (value) => {
    state.locale = value;
    choose();
    check(0);
    check(1);
    await submit();
    expect(harness.fetch).not.toHaveBeenCalled();
    check(2);
    harness.fetch.mockRejectedValueOnce(new Error("lost"));
    await submit();
    const [url, init] = harness.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/library/collections/lcol_target");
    expect(JSON.parse(String(init.body))).toMatchObject({
      action: "copy-items",
      sourceCollectionId: "lcol_source",
      expectedSourceRevision: 4,
      expectedRevision: 2,
      productIds: ["prd_a", "prd_b"],
    });
    state.source = { ...state.source, id: "lcol_other_source", revision: 9 };
    state.destinations = [{ ...firstDestination(), id: "lcol_other_target", revision: 9 }];
    harness.fetch.mockResolvedValueOnce(success(init));
    await submit();
    expect(harness.fetch.mock.calls[1][0]).toBe(url);
    expect(harness.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(
      render().some(
        (n) =>
          n.props.role === "status" &&
          n.props.children === libraryCollectionsCopy(state.locale).saved,
      ),
    ).toBe(true);
    expect(render().find((n) => n.type === "a")?.props.href).toBe(
      "/workspace/library/collections/lcol_target",
    );
  },
);

it("counts only missing destination references against its capacity", async () => {
  reviewed();
  harness.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => success(init));
  await submit();
  expect(harness.fetch).toHaveBeenCalledOnce();
  harness.slots = [];
  state.destinations = [{ ...firstDestination(), presentProductIds: [] }];
  reviewed();
  await submit();
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(
    render().some(
      (n) =>
        (typeof n.type !== "string" &&
          (n.type as { name?: string }).name === "ErrorState" &&
          n.props.title === libraryCollectionsCopy("en").quota) ||
        (n.props.role === "alert" &&
          Array.isArray(n.props.children) &&
          JSON.stringify(n.props.children).includes(libraryCollectionsCopy("en").quota)),
    ),
  ).toBe(true);
});

it("clears acknowledgement whenever destination or selected references change", async () => {
  reviewed();
  check(0, false);
  await submit();
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("does not accept a receipt with altered source proof", async () => {
  reviewed();
  harness.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) =>
    success(init, { command: { ...JSON.parse(String(init.body)), expectedSourceRevision: 9 } }),
  );
  await submit();
  expect(render().some((n) => n.props.role === "status")).toBe(false);
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
});

it("blocks stale handlers after a conflict and requires reload", async () => {
  reviewed();
  const tree = render();
  harness.fetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({ code: "COLLECTION_CONFLICT" }),
  });
  await submit(tree);
  await submit(tree);
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(
    render()
      .filter((n) => n.type === "button")
      .every((n) => n.props.type === "button"),
  ).toBe(true);
  const button = render().find((n) => n.type === "button");
  if (!button) throw new Error("Missing reload action");
  (button.props.onClick as () => void)();
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("coalesces duplicate submissions and ignores a successful response after unmount", async () => {
  reviewed();
  let resolve: (v: unknown) => void = () => {};
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const tree = render(),
    pending = submit(tree);
  await submit(tree);
  expect(harness.fetch).toHaveBeenCalledOnce();
  const init = harness.fetch.mock.calls[0][1] as RequestInit;
  harness.cleanup?.();
  expect(init.signal?.aborted).toBe(true);
  resolve(success(init));
  await pending;
  expect(render().some((n) => n.props.role === "status")).toBe(false);
});
