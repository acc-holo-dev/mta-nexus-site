import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionsBatchInteractionHelpers,
  mockReactHooks,
} from "./helpers/library-collections-batch-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  cleanup: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { LibraryCollectionBatchForm } from "../apps/web/src/components/library-collection-batch";

const { render, check, submit, success } = createLibraryCollectionsBatchInteractionHelpers(
  harness,
  LibraryCollectionBatchForm,
);

it("does not refresh on an acknowledgement with changed batch references", async () => {
  check(0);
  check(2);
  harness.fetch.mockImplementationOnce(async (_: string, init: RequestInit) =>
    success({ ...JSON.parse(String(init.body)), productIds: ["prd_other"] }),
  );
  await submit();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
});

it("coalesces simultaneous submissions into one canonical batch request", async () => {
  check(0);
  check(1);
  check(2);
  let finish: (v: unknown) => void = () => {};
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tree = render(),
    running = submit(tree);
  await submit(tree);
  expect(harness.fetch).toHaveBeenCalledOnce();
  const command = JSON.parse(String(harness.fetch.mock.calls[0]?.[1].body));
  expect(command.productIds).toEqual(["prd_a", "prd_b"]);
  finish(success(command));
  await running;
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it.each([400, 401, 403, 404, 409, 413, 415])(
  "blocks stale batch handlers after definitive status %s",
  async (status) => {
    check(0);
    check(2);
    const tree = render();
    harness.fetch.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ code: "COLLECTION_CONFLICT" }),
    });
    await submit(tree);
    await submit(tree);
    expect(harness.fetch).toHaveBeenCalledOnce();
    expect(render().find((n) => n.type === "button")?.props.disabled).toBe(true);
  },
);

it("ignores stale handlers after a confirmed batch", async () => {
  check(0);
  check(2);
  const tree = render();
  harness.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) =>
    success(JSON.parse(String(init.body))),
  );
  await submit(tree);
  await submit(tree);
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("lists per-item batch outcomes after a confirmed remove-many", async () => {
  const { libraryCollectionsCopy } = await import("../apps/web/src/lib/library-collections-i18n");
  check(1);
  check(2);
  harness.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) =>
    success(JSON.parse(String(init.body))),
  );
  await submit();
  const html = JSON.stringify(render());
  expect(html).toContain(libraryCollectionsCopy("en").batchApplied);
  expect(html).toContain("prd_a");
});
