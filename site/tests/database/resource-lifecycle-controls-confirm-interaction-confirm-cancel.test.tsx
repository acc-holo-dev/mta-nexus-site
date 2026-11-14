import { expect, it, vi } from "vitest";
import {
  createResourceLifecycleControlsConfirmInteractionHelpers,
  mockReactHooks,
  productId,
} from "../helpers/resource-lifecycle-controls-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh }),
}));
vi.mock("../../src/components/locale-context", async () => {
  const { getDictionary } = await import("../../src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { ResourceLifecycleControls } from "../../src/features/resources/components/resource-lifecycle-controls";
import { getResourceCommerceCopy } from "../../src/lib/resource-commerce-i18n";

const { render, submit, seedControls } = createResourceLifecycleControlsConfirmInteractionHelpers(
  harness,
  ResourceLifecycleControls,
  confirmAction,
);

it("does not archive a resource when confirmation is cancelled", async () => {
  const copy = getResourceCommerceCopy("en");
  seedControls("published", "archive");
  const slotsBefore = structuredClone(harness.slots);
  confirmAction.mockResolvedValueOnce(false);

  await submit(render("published"));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.archive,
    object: productId,
    consequences: copy.archiveNote,
    confirmLabel: copy.archive,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.slots).toEqual(slotsBefore);
});

it("does not restore a resource when confirmation is cancelled", async () => {
  const copy = getResourceCommerceCopy("en");
  seedControls("archived", "restore");
  confirmAction.mockResolvedValueOnce(false);

  await submit(render("archived"));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.restore,
    object: productId,
    consequences: copy.restoreNote,
    confirmLabel: copy.restore,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: false,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
});

it("does not submit a draft when confirmation is cancelled", async () => {
  const copy = getResourceCommerceCopy("en");
  seedControls("draft", "submit");
  confirmAction.mockResolvedValueOnce(false);

  await submit(render("draft"));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.submit,
    object: productId,
    consequences: copy.submitNote,
    confirmLabel: copy.submit,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: false,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
});
