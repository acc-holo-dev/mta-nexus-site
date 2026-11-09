import { expect, it, vi } from "vitest";
import {
  createDiscussionReportBatchInteractionHelpers,
  mockReactHooks,
  preview,
} from "../helpers/discussion-report-batch-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  confirm: vi.fn(),
  reload: vi.fn(),
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../../apps/web/src/components/confirm-action", () => ({
  confirmAction: (...args: unknown[]) => harness.confirm(...args),
}));

import { DiscussionReportBatch } from "../../apps/web/src/components/discussion-report-batch";
import { reportBatchCopy } from "../../apps/web/src/lib/report-batch-copy";

const { render, commitBatch, review } = createDiscussionReportBatchInteractionHelpers(
  harness,
  DiscussionReportBatch,
);

it("does not commit a resolved report batch when confirmAction is cancelled", async () => {
  const copy = reportBatchCopy("en");
  await review();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  harness.confirm.mockResolvedValueOnce(false);
  await commitBatch(() => render(), copy.confirm);
  await vi.waitFor(() => expect(harness.confirm).toHaveBeenCalledTimes(1));
  expect(harness.confirm).toHaveBeenCalledWith({
    title: copy.previewTitle,
    object: preview.publication.title,
    scope: `${preview.items.length}`,
    consequences: `${copy.notes}: ${preview.notes}`,
    confirmLabel: copy.confirm,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: false,
  });
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(
    render().some((node) => node.props.role === "status" && node.props.children === copy.saved),
  ).toBe(false);
});
