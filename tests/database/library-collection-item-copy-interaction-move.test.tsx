import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionItemCopyInteractionHelpers,
  mockReactHooks,
} from "../helpers/library-collection-item-copy-interaction-harness";

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

import { LibraryCollectionItemCopyForm } from "../../site/src/components/library-collection-item-copy";
import { libraryCollectionsCopy } from "../../site/src/lib/library-collections-i18n";

const { state, render, check, submit, reviewed, success } =
  createLibraryCollectionItemCopyInteractionHelpers(harness, LibraryCollectionItemCopyForm);

it.each(["en", "ru"] as const)(
  "moves from an active source with an exact UUID retry and confirms both successors in %s",
  async (value) => {
    state.locale = value;
    state.move = true;
    state.source = { ...state.source, status: "active" };
    reviewed();
    harness.fetch.mockRejectedValueOnce(new Error("lost"));
    await submit();
    const init = harness.fetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      action: "move-items",
      expectedSourceRevision: 4,
      expectedRevision: 2,
      productIds: ["prd_a", "prd_b"],
    });
    harness.fetch.mockResolvedValueOnce(success(init));
    await submit();
    expect(harness.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(render().some((n) => n.props.role === "status")).toBe(true);
    expect(
      render()
        .filter((n) => n.type === "a")
        .map((n) => n.props.href),
    ).toEqual([
      "/workspace/library/collections/lcol_source",
      "/workspace/library/collections/lcol_target",
    ]);
  },
);

it("does not offer move submission for an archived source", () => {
  state.move = true;
  expect(
    render().some((n) => n.props.children === libraryCollectionsCopy("en").moveSourceUnavailable),
  ).toBe(true);
  expect(render().some((n) => n.type === "form")).toBe(false);
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("does not confirm a destination-only move acknowledgement", async () => {
  state.move = true;
  state.source = { ...state.source, status: "active" };
  reviewed();
  harness.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) =>
    success(init, { sourceCollection: undefined }),
  );
  await submit();
  expect(render().some((n) => n.props.role === "status")).toBe(false);
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
});

it("preselects a reviewed comparison destination while still requiring selection and acknowledgement", async () => {
  state.initialDestinationId = "lcol_target";
  expect(render().find((n) => n.type === "select")?.props.value).toBe("lcol_target");
  await submit();
  expect(harness.fetch).not.toHaveBeenCalled();
  check(0);
  check(2);
  harness.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => success(init));
  await submit();
  expect(harness.fetch).toHaveBeenCalledOnce();
});

it("retains selected IDs, source proof and destination after comparison props disappear", async () => {
  reviewed();
  harness.fetch.mockRejectedValueOnce(new Error("lost"));
  await submit();
  const init = harness.fetch.mock.calls[0]?.[1] as RequestInit;
  state.source = { ...state.source, id: "lcol_other_source", name: "New source", revision: 99 };
  state.destinations = [];
  state.entries = [];
  state.move = true;
  const tree = render();
  expect(tree.find((n) => n.type === "select")?.props.value).toBe("lcol_target");
  expect(tree.filter((n) => n.type === "code").map((n) => n.props.children)).toEqual([
    "prd_a",
    "prd_b",
  ]);
  harness.fetch.mockResolvedValueOnce(success(init));
  await submit(tree);
  expect(harness.fetch.mock.calls[1]?.[1].body).toBe(init.body);
  expect(render().some((n) => n.props.role === "status")).toBe(true);
  expect(
    render()
      .filter((n) => n.type === "a")
      .map((n) => n.props.href),
  ).toEqual(["/workspace/library/collections/lcol_target"]);
});

it("does not restart an old comparison transfer handler after unmount", async () => {
  reviewed();
  const tree = render();
  harness.cleanup?.();
  await submit(tree);
  expect(harness.fetch).not.toHaveBeenCalled();
});
