import { expect, it, vi } from "vitest";
import {
  createDiscussionReportBatchInteractionHelpers,
  mockReactHooks,
  preview,
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
vi.mock("../apps/web/src/components/confirm-action", () => ({
  confirmAction: (...args: unknown[]) => harness.confirm(...args),
}));

import { DiscussionReportBatch } from "../apps/web/src/components/discussion-report-batch";
import { reportBatchCopy } from "../apps/web/src/lib/report-batch-copy";

const { render, click, select, review } = createDiscussionReportBatchInteractionHelpers(
  harness,
  DiscussionReportBatch,
);

it("does not submit without selection/reason and allows preview cancellation without a write", async () => {
  click(render(), reportBatchCopy("en").preview);
  expect(harness.fetch).not.toHaveBeenCalled();
  await review();
  click(render(), reportBatchCopy("en").cancel);
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(render().some((node) => node.props.children === reportBatchCopy("en").confirm)).toBe(
    false,
  );
});

it.each([
  { ...preview, commentId: "foreign" },
  { ...preview, contentId: "foreign" },
  { ...preview, notes: "Changed reason" },
  { ...preview, items: [preview.items[0]] },
  { ...preview, private: "secret" },
])("rejects an unexpected preview before enabling a write %j", async (reply) => {
  harness.fetch.mockResolvedValue(response(reply));
  select();
  click(render(), reportBatchCopy("en").preview);
  await vi.waitFor(() =>
    expect(flatTreeHasErrorText(render(), reportBatchCopy("en").unavailable)).toBe(true),
  );
  expect(render().some((node) => node.props.children === reportBatchCopy("en").confirm)).toBe(
    false,
  );
  expect(harness.fetch).toHaveBeenCalledTimes(1);
});

it("keeps completed-history cards navigable without selection or write controls", () => {
  const nodes = render("en", false);
  expect(
    nodes.some(
      (node) => node.type === "button" || node.type === "textarea" || node.type === "input",
    ),
  ).toBe(false);
  expect(nodes.some((node) => node.props.href === "/admin/reports/a")).toBe(true);
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("does not accept a comment preview or a foreign acknowledgement as a publication decision", async () => {
  harness.fetch.mockResolvedValue(response(preview));
  select("en", true);
  click(render("en", true, true), reportBatchCopy("en").preview);
  await vi.waitFor(() =>
    expect(flatTreeHasErrorText(render("en", true, true), reportBatchCopy("en").unavailable)).toBe(
      true,
    ),
  );
  expect(
    render("en", true, true).some((node) => node.props.children === reportBatchCopy("en").confirm),
  ).toBe(false);
});
