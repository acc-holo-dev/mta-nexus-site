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
vi.mock("../../src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh, push: harness.push }),
}));

import { LibraryCollectionCommandForm } from "../../src/components/library-collection-command";
import { libraryCollectionsCopy } from "../../src/lib/library-collections-i18n";

const { collection, render, submit, success } = createLibraryCollectionsInteractionHelpers(
  harness,
  LibraryCollectionCommandForm,
  confirmAction,
);

it("requires restore acknowledgement before submitting and skips on cancel", async () => {
  const copy = libraryCollectionsCopy("en");
  confirmAction.mockResolvedValueOnce(false);
  await submit(render("restore"));
  expect(harness.fetch).not.toHaveBeenCalled();
  confirmAction.mockResolvedValueOnce(true);
  harness.fetch.mockImplementationOnce(async (_: string, init: RequestInit) =>
    success(JSON.parse(String(init.body)), { ...collection, status: "active", revision: 5 }),
  );
  await submit(render("restore"));
  expect(confirmAction).toHaveBeenCalledWith(
    expect.objectContaining({
      title: copy.restore,
      consequences: copy.restoreConfirm,
      confirmLabel: copy.restore,
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("requires remove acknowledgement before submitting and skips on cancel", async () => {
  const copy = libraryCollectionsCopy("en");
  confirmAction.mockResolvedValueOnce(false);
  await submit(render("remove"));
  expect(harness.fetch).not.toHaveBeenCalled();
  confirmAction.mockResolvedValueOnce(true);
  harness.fetch.mockImplementationOnce(async (_: string, init: RequestInit) =>
    success(JSON.parse(String(init.body)), { ...collection, revision: 5 }),
  );
  await submit(render("remove"));
  expect(confirmAction).toHaveBeenCalledWith(
    expect.objectContaining({
      title: copy.remove,
      consequences: copy.removeConfirm,
      confirmLabel: copy.remove,
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});
