import { expect, it, vi } from "vitest";
import {
  createLibraryMembershipBatchesInteractionHelpers,
  mockReactHooks,
} from "../helpers/library-membership-batches-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  cleanup: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { LibraryMembershipBatchForm } from "../../src/components/library-membership-batch";

const { state, render, check, submit, reviewed, success, fixture } =
  createLibraryMembershipBatchesInteractionHelpers(harness, LibraryMembershipBatchForm);

it.each(["en", "ru"] as const)(
  "reviews a mixed membership group and freezes every %s retry proof",
  async (value) => {
    state.locale = value;
    check(0, false);
    check(1, true);
    await submit();
    expect(harness.fetch).not.toHaveBeenCalled();
    check(2, true);
    harness.fetch.mockRejectedValueOnce(Error("lost response"));
    await submit();
    const [url, init] = harness.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/library/prd_a/collections");
    expect(JSON.parse(String(init.body))).toMatchObject({
      changes: [
        {
          collectionId: "lcol_a",
          expectedRevision: 2,
          wasInCollection: true,
          inCollection: false,
        },
        {
          collectionId: "lcol_b",
          expectedRevision: 4,
          wasInCollection: false,
          inCollection: true,
        },
      ],
    });
    state.report = {
      ...fixture(),
      resource: { ...fixture().resource, productId: "prd_other" },
      collections: [],
    };
    harness.fetch.mockResolvedValueOnce(success(init));
    await submit();
    expect(harness.fetch.mock.calls[1]?.[0]).toBe(url);
    expect(harness.fetch.mock.calls[1]?.[1].body).toBe(init.body);
    expect(harness.refresh).toHaveBeenCalledOnce();
    expect(render().some((n) => n.props.role === "status")).toBe(true);
    expect(
      render().some(
        (n) => n.props.href === "/workspace/library/collections/membership-history/lmb_a",
      ),
    ).toBe(true);
  },
);

it("refuses incomplete confirmation and retains an identical retry", async () => {
  reviewed();
  harness.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) =>
    success(init, fixture(), true),
  );
  await submit();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
  const init = harness.fetch.mock.calls[0]?.[1] as RequestInit;
  harness.fetch.mockResolvedValueOnce(success(init));
  await submit();
  expect(harness.fetch.mock.calls[1]?.[1].body).toBe(init.body);
});

it("aborts on unmount and ignores late success", async () => {
  reviewed();
  let resolve: (v: unknown) => void = () => {};
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const tree = render(),
    pending = submit(tree),
    init = harness.fetch.mock.calls[0]?.[1] as RequestInit;
  harness.cleanup?.();
  expect(init.signal?.aborted).toBe(true);
  resolve(success(init));
  await pending;
  await submit(tree);
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.fetch).toHaveBeenCalledOnce();
});
