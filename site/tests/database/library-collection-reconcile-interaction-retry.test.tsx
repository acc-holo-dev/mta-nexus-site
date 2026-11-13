import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionReconcileInteractionHelpers,
  mockReactHooks,
} from "../helpers/library-collection-reconcile-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  cleanup: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { LibraryCollectionReconcileForm } from "../../src/components/library-collection-reconcile";

const { collection, freeze, fixture, state, render, check, submit, success } =
  createLibraryCollectionReconcileInteractionHelpers(harness, LibraryCollectionReconcileForm);

it.each(["en", "ru"] as const)(
  "reviews a full-collection swap and retains exact retry/receipt proof in %s",
  async (lang) => {
    state.locale = lang;
    check(0);
    check(2);
    await submit();
    expect(harness.fetch).not.toHaveBeenCalled();
    check(1);
    await submit();
    expect(harness.fetch).not.toHaveBeenCalled();
    check(2);
    harness.fetch.mockRejectedValueOnce(Error("uncertain"));
    await submit();
    const [url, init] = harness.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/library/collections/lcol_a");
    expect(JSON.parse(String(init.body))).toMatchObject({
      action: "reconcile-items",
      expectedRevision: 7,
      addProductIds: ["prd_new"],
      removeProductIds: ["prd_old"],
    });
    expect(freeze).toHaveBeenCalledOnce();
    state.report = {
      ...fixture(),
      collection: { ...collection, id: "lcol_other", status: "archived", revision: 9 },
      itemCount: 0,
      items: [],
    };
    harness.fetch.mockResolvedValueOnce(success(init));
    await submit();
    expect(harness.fetch.mock.calls[1]?.[0]).toBe(url);
    expect(harness.fetch.mock.calls[1]?.[1].body).toBe(init.body);
    expect(freeze).toHaveBeenCalledOnce();
    expect(harness.refresh).toHaveBeenCalledOnce();
    expect(
      render().some((n) => n.props.href === "/workspace/library/collections/receipts/lcr_original"),
    ).toBe(true);
    expect(
      render().some(
        (n) => n.props.href === "/workspace/library/collections/receipts/lcr_reconcile",
      ),
    ).toBe(true);
    expect(
      render().some((n) => n.props.href === "/workspace/library/collections/lcol_a/history"),
    ).toBe(true);
  },
);

it("aborts on unmount and ignores late confirmations", async () => {
  check(1);
  check(2);
  let finish: (value: unknown) => void = () => {};
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tree = render(),
    running = submit(tree),
    init = harness.fetch.mock.calls[0]?.[1] as RequestInit;
  harness.cleanup?.();
  expect(init.signal?.aborted).toBe(true);
  finish(success(init));
  await running;
  await submit(tree);
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.fetch).toHaveBeenCalledOnce();
});
