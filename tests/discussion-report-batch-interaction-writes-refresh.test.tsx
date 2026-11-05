import { expect, it, vi } from "vitest";
import {
  createDiscussionReportBatchInteractionHelpers,
  mockReactHooks,
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
vi.mock("../apps/web/src/components/confirm-action", () => ({
  confirmAction: (...args: unknown[]) => harness.confirm(...args),
}));

import { DiscussionReportBatch } from "../apps/web/src/components/discussion-report-batch";
import { reportBatchCopy } from "../apps/web/src/lib/report-batch-copy";

const { render, commitBatch, review } = createDiscussionReportBatchInteractionHelpers(
  harness,
  DiscussionReportBatch,
);

it("retains confirmed saved decisions if refreshing the page fails", async () => {
  await review();
  harness.refresh.mockImplementationOnce(() => {
    throw Error("PRIVATE_REFRESH");
  });
  await commitBatch(() => render(), reportBatchCopy("en").confirm);
  await vi.waitFor(() =>
    expect(flatTreeHasErrorText(render(), reportBatchCopy("en").unavailable)).toBe(true),
  );
  expect(
    render().some(
      (node) => node.props.role === "status" && node.props.children === reportBatchCopy("en").saved,
    ),
  ).toBe(true);
  expect(harness.fetch).toHaveBeenCalledTimes(2);
});
