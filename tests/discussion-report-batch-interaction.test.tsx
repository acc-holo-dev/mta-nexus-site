import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  confirm: vi.fn(),
  reload: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [
      harness.slots[index],
      (value: unknown) => {
        harness.slots[index] = typeof value === "function" ? value(harness.slots[index]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = { current: initial };
    return harness.slots[index];
  },
  useEffect: (effect: () => () => void) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) {
      harness.slots[index] = true;
      harness.cleanups.push(effect());
    }
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { DiscussionReportBatch } from "../apps/web/src/components/discussion-report-batch";
import { reportBatchCopy } from "../apps/web/src/lib/report-batch-copy";

const time = "2026-10-11T00:00:00.123456Z",
  token = "a".repeat(64);
const items = [
  {
    id: "a",
    type: "spam" as const,
    reason: "First reason",
    status: "open" as const,
    createdAt: time,
    resolvedAt: null,
  },
  {
    id: "b",
    type: "spam" as const,
    reason: "Second reason",
    status: "under_review" as const,
    createdAt: time,
    resolvedAt: null,
  },
];
const preview = {
  contentId: "post",
  commentId: "comment",
  publication: { id: "post", title: "Title", status: "archived" },
  comment: { id: "comment", text: "Reviewed full text", truncated: false, revision: token },
  action: "resolve",
  notes: "Recorded reason",
  previewRevision: token,
  items: items.map((item) => ({
    id: item.id,
    type: item.type,
    reason: item.reason,
    createdAt: time,
    before: item.status,
    after: "resolved",
  })),
};
const ack = {
  contentId: "post",
  commentId: "comment",
  action: "resolve",
  previewRevision: token,
  items: items.map((item) => ({ id: item.id, status: "resolved" })),
};
type Element = ReactElement<Record<string, unknown>>;
function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...descendants(element.props.children as ReactNode)];
}
function render(locale: "ru" | "en" = "en", allowActions = true, publication = false) {
  harness.cursor = 0;
  return descendants(
    DiscussionReportBatch({
      contentId: "post",
      commentId: publication ? null : "comment",
      items,
      locale,
      allowActions,
    }),
  );
}
function button(nodes: Element[], label: string) {
  const node = nodes.find((node) => node.type === "button" && node.props.children === label);
  if (!node) throw Error(`Missing ${label}`);
  return node;
}
function click(nodes: Element[], label: string) {
  return (button(nodes, label).props.onClick as () => void)();
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function select(locale: "ru" | "en" = "en", publication = false) {
  const copy = reportBatchCopy(locale);
  click(render(locale, true, publication), copy.selectAll);
  const textarea = render(locale, true, publication).find((node) => node.type === "textarea");
  if (!textarea) throw Error("Missing notes");
  (textarea.props.onChange as (event: unknown) => void)({ target: { value: "Recorded reason" } });
}
async function review(locale: "ru" | "en" = "en") {
  select(locale);
  click(render(locale), reportBatchCopy(locale).preview);
  await vi.waitFor(() =>
    expect(
      render(locale).some((node) => node.props.children === reportBatchCopy(locale).confirm),
    ).toBe(true),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.cleanups = [];
  harness.fetch
    .mockReset()
    .mockImplementation((url: string) =>
      Promise.resolve(response(url.endsWith("/preview") ? preview : ack)),
    );
  vi.stubGlobal("fetch", harness.fetch);
  vi.stubGlobal("window", { location: { reload: harness.reload } });
});
afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup();
  vi.unstubAllGlobals();
});
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
    click(render(locale), copy.confirm);
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
  click(confirmed, reportBatchCopy("en").confirm);
  click(confirmed, reportBatchCopy("en").confirm);
  expect(harness.fetch).toHaveBeenCalledTimes(2);
  finish(response(ack));
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
  click(confirmed, reportBatchCopy("en").confirm);
  expect(harness.fetch).toHaveBeenCalledTimes(2);
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
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(render().some((node) => node.props.children === reportBatchCopy("en").confirm)).toBe(
    false,
  );
  expect(harness.fetch).toHaveBeenCalledTimes(1);
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
  click(before, reportBatchCopy("en").confirm);
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(harness.refresh).not.toHaveBeenCalled();
  click(before, reportBatchCopy("en").confirm);
  expect(harness.fetch).toHaveBeenCalledTimes(2);
  click(render(), reportBatchCopy("en").reload);
  expect(harness.reload).toHaveBeenCalledTimes(1);
});
it("shows a localized stale-review failure without exposing server detail", async () => {
  await review("ru");
  harness.fetch.mockResolvedValue(
    response({ code: "REPORT_BATCH_CHANGED", error: "PRIVATE_SQL" }, 409),
  );
  click(render("ru"), reportBatchCopy("ru").confirm);
  await vi.waitFor(() =>
    expect(render("ru").some((node) => node.props.role === "alert")).toBe(true),
  );
  expect(render("ru").find((node) => node.props.role === "alert")?.props.children).toBe(
    reportBatchCopy("ru").changed,
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
  click(render(), reportBatchCopy("en").confirm);
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(
    render().some(
      (node) => node.props.role === "status" && node.props.children === reportBatchCopy("en").saved,
    ),
  ).toBe(true);
  expect(render().find((node) => node.props.role === "alert")?.props.children).toBe(
    reportBatchCopy("en").unavailable,
  );
  expect(harness.fetch).toHaveBeenCalledTimes(2);
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
    click(reviewed, reportBatchCopy(locale).confirm);
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

it("does not accept a comment preview or a foreign acknowledgement as a publication decision", async () => {
  harness.fetch.mockResolvedValue(response(preview));
  select("en", true);
  click(render("en", true, true), reportBatchCopy("en").preview);
  await vi.waitFor(() =>
    expect(render("en", true, true).some((node) => node.props.role === "alert")).toBe(true),
  );
  expect(
    render("en", true, true).some((node) => node.props.children === reportBatchCopy("en").confirm),
  ).toBe(false);
});
