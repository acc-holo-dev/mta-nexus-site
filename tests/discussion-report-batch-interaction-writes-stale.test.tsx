import { expect, it, vi } from "vitest";
import {
  createDiscussionReportBatchInteractionHelpers,
  mockReactHooks,
  response,
} from "./helpers/discussion-report-batch-interaction-harness";
import { flatTreeHasErrorText } from "./helpers/flatten-react-test-tree";

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
vi.mock("../site/src/components/confirm-action", () => ({
  confirmAction: (...args: unknown[]) => harness.confirm(...args),
}));

import { DiscussionReportBatch } from "../site/src/components/discussion-report-batch";
import { reportBatchCopy } from "../site/src/lib/report-batch-copy";

const { render, commitBatch, review } = createDiscussionReportBatchInteractionHelpers(
  harness,
  DiscussionReportBatch,
);

it("shows a localized stale-review failure without exposing server detail", async () => {
  await review("ru");
  harness.fetch.mockResolvedValue(
    response({ code: "REPORT_BATCH_CHANGED", error: "PRIVATE_SQL" }, 409),
  );
  await commitBatch(() => render("ru"), reportBatchCopy("ru").confirm);
  await vi.waitFor(() =>
    expect(flatTreeHasErrorText(render("ru"), reportBatchCopy("ru").changed)).toBe(true),
  );
  expect(harness.refresh).not.toHaveBeenCalled();
});
