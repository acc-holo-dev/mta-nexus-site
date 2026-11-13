import { expect, it, vi } from "vitest";
import {
  ack,
  createDiscussionReportBatchInteractionHelpers,
  mockReactHooks,
  preview,
  response,
  token,
} from "./helpers/discussion-report-batch-interaction-harness";

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

const { render, click, commitBatch, select, review } =
  createDiscussionReportBatchInteractionHelpers(harness, DiscussionReportBatch);

it.each(["ru", "en"] as const)(
  "reviews frozen selected identities before issuing a confirmed scoped decision in %s",
  async (locale) => {
    const copy = reportBatchCopy(locale);
    await review(locale);
    expect(harness.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = harness.fetch.mock.calls[0];
    expect(url).toBe("/api/admin/community/post/discussion/comment/reports/batch/preview");
    expect(JSON.parse(init.body)).toEqual({
      items: [
        { id: "a", expectedStatus: "open" },
        { id: "b", expectedStatus: "under_review" },
      ],
      action: "resolve",
      notes: "Recorded reason",
    });
    expect(render(locale).some((node) => node.props.children === "Reviewed full text")).toBe(true);
    await commitBatch(() => render(locale), copy.confirm);
    await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
    expect(harness.fetch).toHaveBeenCalledTimes(2);
    expect(harness.fetch.mock.calls[1][0]).toBe(
      "/api/admin/community/post/discussion/comment/reports/batch",
    );
    expect(JSON.parse(harness.fetch.mock.calls[1][1].body)).toEqual({
      ...JSON.parse(init.body),
      previewRevision: token,
    });
    expect(
      render(locale).some(
        (node) => node.props.role === "status" && node.props.children === copy.saved,
      ),
    ).toBe(true);
  },
);

it.each(["ru", "en"] as const)(
  "reviews and commits publication batches through the shared frozen-selection controller in %s",
  async (locale) => {
    const publicationPreview = {
        ...preview,
        commentId: null,
        comment: null,
        publication: { ...preview.publication, text: "Reviewed publication body", truncated: true },
      },
      publicationAck = { ...ack, commentId: null };
    harness.fetch
      .mockReset()
      .mockImplementation((url: string) =>
        Promise.resolve(response(url.endsWith("/preview") ? publicationPreview : publicationAck)),
      );
    select(locale, true);
    click(render(locale, true, true), reportBatchCopy(locale).preview);
    await vi.waitFor(() =>
      expect(
        render(locale, true, true).some(
          (node) => node.props.children === reportBatchCopy(locale).confirm,
        ),
      ).toBe(true),
    );
    expect(harness.fetch.mock.calls[0][0]).toBe("/api/admin/community/post/reports/batch/preview");
    expect(
      render(locale, true, true).some(
        (node) => node.props.children === "Reviewed publication body",
      ),
    ).toBe(true);
    const reviewed = render(locale, true, true);
    await commitBatch(() => render(locale, true, true), reportBatchCopy(locale).confirm);
    await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
    expect(harness.fetch.mock.calls[1][0]).toBe("/api/admin/community/post/reports/batch");
    expect(JSON.parse(harness.fetch.mock.calls[1][1].body).previewRevision).toBe(token);
    click(reviewed, reportBatchCopy(locale).confirm);
    expect(harness.fetch).toHaveBeenCalledTimes(2);
    expect(
      render(locale, true, true).some(
        (node) =>
          node.props.role === "status" && node.props.children === reportBatchCopy(locale).saved,
      ),
    ).toBe(true);
  },
);
