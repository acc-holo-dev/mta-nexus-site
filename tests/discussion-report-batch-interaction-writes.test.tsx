import { expect, it, vi } from "vitest";
import {
  ack,
  createDiscussionReportBatchInteractionHelpers,
  mockReactHooks,
  preview,
  response,
  token,
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

it.each(["preview", "command"])(
  "aborts %s on navigation and ignores late completion",
  async (phase) => {
    if (phase === "command") await review();
    else select();
    let finish!: (reply: Response) => void;
    harness.fetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    click(
      render(),
      phase === "command" ? reportBatchCopy("en").confirm : reportBatchCopy("en").preview,
    );
    const signal = harness.fetch.mock.calls.at(-1)?.[1].signal;
    for (const cleanup of harness.cleanups.splice(0)) cleanup();
    expect(signal.aborted).toBe(true);
    finish(response(phase === "command" ? ack : preview));
    await new Promise((resolve) => setImmediate(resolve));
    expect(harness.refresh).not.toHaveBeenCalled();
  },
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
