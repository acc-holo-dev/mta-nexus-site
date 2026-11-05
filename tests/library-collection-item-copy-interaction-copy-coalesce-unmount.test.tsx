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

const { render, submit, reviewed, success } = createLibraryCollectionItemCopyInteractionHelpers(
  harness,
  LibraryCollectionItemCopyForm,
);

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
