import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionsInteractionHelpers,
  mockReactHooks,
} from "../helpers/library-collections-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  cleanup: null as (() => void) | null,
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../site/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh, push: harness.push }),
}));

import { LibraryCollectionCommandForm } from "../../site/src/components/library-collection-command";

const { collection, render, submit, success } = createLibraryCollectionsInteractionHelpers(
  harness,
  LibraryCollectionCommandForm,
  confirmAction,
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
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());
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
