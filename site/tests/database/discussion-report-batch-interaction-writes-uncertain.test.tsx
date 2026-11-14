import { expect, it, vi } from "vitest";
import {
  ack,
  createDiscussionReportBatchInteractionHelpers,
  mockReactHooks,
  response,
} from "../helpers/discussion-report-batch-interaction-harness";
import { flatTreeHasErrorText } from "../helpers/flatten-react-test-tree";

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
vi.mock("../../src/components/confirm-action", () => ({
  confirmAction: (...args: unknown[]) => harness.confirm(...args),
}));

import { DiscussionReportBatch } from "../../src/features/community/components/discussion-report-batch";
import { reportBatchCopy } from "../../src/lib/report-batch-copy";

const { render, click, commitBatch, review } = createDiscussionReportBatchInteractionHelpers(
  harness,
  DiscussionReportBatch,
);

it.each([
  { ...ack, commentId: "foreign" },
  { ...ack, contentId: "foreign" },
  { ...ack, previewRevision: "b".repeat(64) },
  { ...ack, items: [{ id: "a", status: "resolved" }] },
  {
    ...ack,
    items: [
      { id: "a", status: "resolved" },
      { id: "b", status: "dismissed" },
    ],
  },
  { ...ack, private: "secret" },
])("requires saved-state reload after uncertain acknowledgement %j", async (reply) => {
  await review();
  harness.fetch.mockResolvedValue(response(reply));
  const before = render();
  await commitBatch(() => render(), reportBatchCopy("en").confirm);
  await vi.waitFor(() =>
    expect(flatTreeHasErrorText(render(), reportBatchCopy("en").uncertain)).toBe(true),
  );
  expect(harness.refresh).not.toHaveBeenCalled();
  click(before, reportBatchCopy("en").confirm);
  expect(harness.fetch).toHaveBeenCalledTimes(2);
  click(render(), reportBatchCopy("en").reload);
  expect(harness.refresh).toHaveBeenCalledTimes(1);
  expect(harness.reload).not.toHaveBeenCalled();
});
