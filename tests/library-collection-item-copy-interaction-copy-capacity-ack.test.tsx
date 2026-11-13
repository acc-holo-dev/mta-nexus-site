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

import { LibraryCollectionItemCopyForm } from "../site/src/components/library-collection-item-copy";
import { libraryCollectionsCopy } from "../site/src/lib/library-collections-i18n";

const { state, firstDestination, render, check, submit, reviewed, success } =
  createLibraryCollectionItemCopyInteractionHelpers(harness, LibraryCollectionItemCopyForm);

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
