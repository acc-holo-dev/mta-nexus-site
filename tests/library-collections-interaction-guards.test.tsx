import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionsInteractionHelpers,
  mockReactHooks,
} from "./helpers/library-collections-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  cleanup: null as (() => void) | null,
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh, push: harness.push }),
}));

import { LibraryCollectionCommandForm } from "../apps/web/src/components/library-collection-command";
import { libraryCollectionsCopy } from "../apps/web/src/lib/library-collections-i18n";

const { collection, render, submit, success } = createLibraryCollectionsInteractionHelpers(
  harness,
  LibraryCollectionCommandForm,
  confirmAction,
);

it("does not mark success or navigate on a mismatched confirmation", async () => {
  harness.fetch.mockImplementationOnce(async (_: string, init: RequestInit) =>
    success(JSON.parse(String(init.body)), { ...collection, id: "lcol_other", revision: 5 }),
  );
  await submit(render());
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
});

it("requires archive acknowledgement before submitting", async () => {
  const copy = libraryCollectionsCopy("en");
  confirmAction.mockResolvedValueOnce(false);
  await submit(render("archive"));
  expect(harness.fetch).not.toHaveBeenCalled();
  confirmAction.mockResolvedValueOnce(true);
  harness.fetch.mockImplementationOnce(async (_: string, init: RequestInit) =>
    success(JSON.parse(String(init.body)), { ...collection, status: "archived", revision: 5 }),
  );
  await submit(render("archive"));
  expect(confirmAction).toHaveBeenCalledWith(
    expect.objectContaining({
      title: copy.archive,
      object: collection.name,
      consequences: copy.archiveConfirm,
      confirmLabel: copy.archive,
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("prevents rapid double submission and never retries a confirmed command", async () => {
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
  const command = JSON.parse(String(harness.fetch.mock.calls[0]?.[1].body));
  resolve(success(command, { ...collection, revision: 5 }));
  await pending;
  await submit(render());
  expect(harness.fetch).toHaveBeenCalledOnce();
});

it.each([400, 401, 403, 404, 409, 413, 415])(
  "blocks stale handlers after definitive status %s",
  async (status) => {
    const tree = render("remove", undefined, {
      returnHref: "/workspace/library/prd_a/collections",
    });
    harness.fetch.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ code: "COLLECTION_CONFLICT" }),
    });
    await submit(tree);
    await submit(tree);
    expect(harness.fetch).toHaveBeenCalledOnce();
    const current = render();
    expect(current.find((n) => n.type === "button")?.props.disabled).toBe(true);
    expect(current.find((n) => n.type === "a")?.props.href).toBe(
      "/workspace/library/prd_a/collections",
    );
  },
);

it("ignores stale handlers after an exact confirmed receipt", async () => {
  harness.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) =>
    success(JSON.parse(String(init.body)), { ...collection, revision: 5 }),
  );
  const tree = render();
  await submit(tree);
  await submit(tree);
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("aborts on unmount and ignores late confirmation", async () => {
  let resolve: (value: unknown) => void = () => {};
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const tree = render(),
    pending = submit(tree);
  const init = harness.fetch.mock.calls[0]?.[1] as RequestInit;
  harness.cleanup?.();
  expect(init.signal?.aborted).toBe(true);
  resolve(success(JSON.parse(String(init.body)), { ...collection, revision: 5 }));
  await pending;
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.push).not.toHaveBeenCalled();
  await submit(tree);
  expect(harness.fetch).toHaveBeenCalledOnce();
});
