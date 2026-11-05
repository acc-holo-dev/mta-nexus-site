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

const { collection, render, mountDuplicate, submit, success } =
  createLibraryCollectionsInteractionHelpers(harness, LibraryCollectionCommandForm, confirmAction);

it("confirms a full source copy and retries exactly before navigating to its new collection", async () => {
  await mountDuplicate();
  const copy = libraryCollectionsCopy("en");
  confirmAction.mockResolvedValueOnce(false);
  await submit(render("duplicate"));
  expect(harness.fetch).not.toHaveBeenCalled();
  confirmAction.mockResolvedValueOnce(true);
  harness.fetch.mockRejectedValueOnce(new Error("response lost"));
  await submit(render("duplicate"));
  expect(confirmAction).toHaveBeenCalledWith(
    expect.objectContaining({
      title: copy.duplicate,
      object: collection.name,
      consequences: copy.copyConfirm,
      confirmLabel: copy.duplicate,
    }),
  );
  expect(harness.fetch.mock.calls[0]?.[0]).toBe("/api/library/collections");
  const init = harness.fetch.mock.calls[0]?.[1] as RequestInit,
    command = JSON.parse(String(init.body));
  expect(command).toMatchObject({
    action: "duplicate",
    name: "Core",
    sourceCollectionId: collection.id,
    expectedRevision: 4,
    expectedItemCount: 200,
    sourceDigest: "a".repeat(64),
  });
  expect(harness.push).not.toHaveBeenCalled();
  harness.fetch.mockResolvedValueOnce(
    success(command, { id: "lcol_copy", name: "Core", status: "active", revision: 1 }),
  );
  await submit(render("duplicate"));
  expect(confirmAction).toHaveBeenCalledTimes(2);
  expect(harness.fetch.mock.calls[1]?.[1].body).toBe(init.body);
  expect(harness.push).toHaveBeenCalledWith("/workspace/library/collections/lcol_copy");
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("rejects a source/preview mismatch before a copy request", async () => {
  const preview = {
    source: { ...collection, id: "lcol_other" },
    itemCount: 2,
    sourceDigest: "a".repeat(64),
  };
  await mountDuplicate(preview);
  await submit(render("duplicate", preview));
  expect(confirmAction).not.toHaveBeenCalled();
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("does not navigate on a copy acknowledgement naming the source as its target", async () => {
  await mountDuplicate();
  harness.fetch.mockImplementationOnce(async (_: string, init: RequestInit) =>
    success(JSON.parse(String(init.body)), { ...collection, revision: 1 }),
  );
  await submit(render("duplicate"));
  expect(harness.push).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
});
