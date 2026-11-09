import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionsBatchInteractionHelpers,
  mockReactHooks,
} from "../helpers/library-collections-batch-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  cleanup: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { LibraryCollectionBatchForm } from "../../apps/web/src/components/library-collection-batch";

const { collection, items, render, check, submit, success } =
  createLibraryCollectionsBatchInteractionHelpers(harness, LibraryCollectionBatchForm);

it("removes unavailable references with a frozen exact retry after response loss", async () => {
  check(1);
  check(2);
  harness.fetch.mockRejectedValueOnce(new Error("timeout"));
  await submit();
  const initial = harness.fetch.mock.calls[0]?.[1] as RequestInit,
    command = JSON.parse(String(initial.body));
  expect(command).toMatchObject({
    action: "remove-many",
    productIds: ["prd_a"],
    expectedRevision: 4,
  });
  expect(render().find((n) => n.type === "fieldset")?.props.disabled).toBe(true);
  expect(harness.refresh).not.toHaveBeenCalled();
  harness.fetch.mockResolvedValueOnce(success(command));
  await submit();
  expect(harness.fetch.mock.calls[1]?.[1].body).toBe(initial.body);
  expect(harness.refresh).toHaveBeenCalledOnce();
  await submit();
  expect(harness.fetch).toHaveBeenCalledTimes(2);
});

it.each(["en", "ru"] as const)(
  "freezes the group endpoint and proof across changing %s props",
  async (locale) => {
    check(1);
    check(2);
    harness.fetch.mockRejectedValueOnce(new Error("lost"));
    await submit(render("remove-many", items, { locale }));
    const [url, init] = harness.fetch.mock.calls[0] as [string, RequestInit];
    harness.fetch.mockResolvedValueOnce(success(JSON.parse(String(init.body))));
    await submit(
      render("add-many", [], {
        locale,
        collection: { ...collection, id: "lcol_other", revision: 9, status: "archived" },
      }),
    );
    expect(harness.fetch.mock.calls[1]?.[0]).toBe(url);
    expect(harness.fetch.mock.calls[1]?.[1].body).toBe(init.body);
    expect(harness.refresh).toHaveBeenCalledOnce();
  },
);

it("aborts a batch on unmount and ignores its late confirmation", async () => {
  check(0);
  check(2);
  let finish: (v: unknown) => void = () => {};
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const tree = render(),
    running = submit(tree),
    init = harness.fetch.mock.calls[0]?.[1] as RequestInit;
  harness.cleanup?.();
  expect(init.signal?.aborted).toBe(true);
  finish(success(JSON.parse(String(init.body))));
  await running;
  await submit(tree);
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.fetch).toHaveBeenCalledOnce();
});

it("respects import capacity, exposes stable receipt and freezes the parent once across uncertain retry", async () => {
  const entries = items.map((item) => ({ ...item, hasAccess: true })),
    onFreeze = vi.fn(),
    props = {
      maxSelection: 1,
      returnHref: "/workspace/library/collections/lcol_a/import",
      onFreeze,
    };
  const first = render("add-many", entries, props).filter((n) => n.type === "input")[0];
  if (!first) throw Error("Missing choice");
  (first.props.onChange as (e: unknown) => void)({ target: { checked: true } });
  const tree = render("add-many", entries, props),
    inputs = tree.filter((n) => n.type === "input");
  expect(inputs[1]?.props.disabled).toBe(true);
  const ack = inputs[2];
  if (!ack) throw Error("Missing acknowledgement");
  (ack.props.onChange as (e: unknown) => void)({ target: { checked: true } });
  harness.fetch.mockRejectedValueOnce(Error("lost"));
  await submit(render("add-many", entries, props));
  expect(onFreeze).toHaveBeenCalledOnce();
  const init = harness.fetch.mock.calls[0]?.[1] as RequestInit;
  harness.fetch.mockResolvedValueOnce(success(JSON.parse(String(init.body))));
  await submit(render("add-many", entries, props));
  expect(onFreeze).toHaveBeenCalledOnce();
  expect(
    render("add-many", entries, props).some(
      (n) => n.props.href === "/workspace/library/collections/lcol_a/import",
    ),
  ).toBe(true);
  expect(
    render("add-many", entries, props).some(
      (n) => n.props.href === "/workspace/library/collections/lcol_a/history",
    ),
  ).toBe(true);
});
