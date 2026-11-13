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
import { libraryCollectionsCopy } from "../../site/src/lib/library-collections-i18n";

const { collection, render, submit, success } = createLibraryCollectionsInteractionHelpers(
  harness,
  LibraryCollectionCommandForm,
  confirmAction,
);

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
