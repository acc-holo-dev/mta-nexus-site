import { expect, it, vi } from "vitest";
import {
  createResourceReleaseWatchBatchInteractionHelpers,
  mockReactHooks,
} from "../helpers/resource-release-watch-batch-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  locale: "en",
  cleanup: null as (() => void) | null,
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("react", async (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));

import { ResourceReleaseWatchBatchControls } from "../../src/components/resource-release-watch-batch-controls";
import { resourceReleaseWatchesCopy } from "../../src/lib/resource-release-watches-i18n";

const { button, click, reviewed } = createResourceReleaseWatchBatchInteractionHelpers(
  h,
  ResourceReleaseWatchBatchControls,
  confirmAction,
);

it("does not stop a selected watch batch when confirmAction is cancelled", async () => {
  const copy = resourceReleaseWatchesCopy("en");
  reviewed();
  confirmAction.mockResolvedValueOnce(false);
  await click(copy.applyBatch);
  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.stopConfirmTitle,
    object: copy.title,
    scope: "2",
    consequences: copy.stopConfirm,
    confirmLabel: copy.applyBatch,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: false,
  });
  expect(h.fetch).not.toHaveBeenCalled();
  expect(h.refresh).not.toHaveBeenCalled();
  expect(button(copy.applyBatch).props.disabled).toBe(false);
});
