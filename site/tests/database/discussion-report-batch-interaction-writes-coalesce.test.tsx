import { expect, it, vi } from "vitest";
import {
  ack,
  createDiscussionReportBatchInteractionHelpers,
  mockReactHooks,
  preview,
  response,
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
vi.mock("../../src/components/confirm-action", () => ({
  confirmAction: (...args: unknown[]) => harness.confirm(...args),
}));

import { DiscussionReportBatch } from "../../src/features/community/components/discussion-report-batch";
import { reportBatchCopy } from "../../src/lib/report-batch-copy";

const { render, click, commitBatch, select } = createDiscussionReportBatchInteractionHelpers(
  harness,
  DiscussionReportBatch,
);

it("coalesces rapid preview/decision commands and blocks stale handler retries after success", async () => {
  select();
  let finishPreview!: (reply: Response) => void;
  harness.fetch.mockReset().mockReturnValue(
    new Promise<Response>((resolve) => {
      finishPreview = resolve;
    }),
  );
  const nodes = render();
  click(nodes, reportBatchCopy("en").preview);
  click(nodes, reportBatchCopy("en").preview);
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  finishPreview(response(preview));
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.children === reportBatchCopy("en").confirm)).toBe(
      true,
    ),
  );
  let finish!: (reply: Response) => void;
  harness.fetch.mockReturnValue(
    new Promise<Response>((resolve) => {
      finish = resolve;
    }),
  );
  const confirmed = render();
  await commitBatch(() => render(), reportBatchCopy("en").confirm);
  click(render(), reportBatchCopy("en").confirm);
  expect(harness.fetch).toHaveBeenCalledTimes(2);
  finish(response(ack));
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
  click(confirmed, reportBatchCopy("en").confirm);
  expect(harness.fetch).toHaveBeenCalledTimes(2);
});
