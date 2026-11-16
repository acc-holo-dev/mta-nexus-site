import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { reportBatchCopy } from "../../src/lib/report-batch-copy";
import {
  type FlatTestElement,
  findTestButton,
  flattenReactTestTree,
} from "./flatten-react-test-tree";

export type DiscussionReportBatchHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: (() => void)[];
  fetch: Mock;
  refresh: Mock;
  confirm: Mock;
  reload: Mock;
};

/** Props match the fixture literals so real DiscussionReportBatch stays assignable. */
export type DiscussionReportBatchComponent = (props: {
  contentId: string;
  commentId: string | null;
  items: typeof items;
  locale: "ru" | "en";
  allowActions: boolean;
}) => ReactNode;

const time = "2026-10-11T00:00:00.123456Z";
export const token = "a".repeat(64);

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

export const preview = {
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

export const ack = {
  contentId: "post",
  commentId: "comment",
  action: "resolve",
  previewRevision: token,
  items: items.map((item) => ({ id: item.id, status: "resolved" })),
};

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for discussion-report-batch suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: DiscussionReportBatchHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
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
  });
}

export function createDiscussionReportBatchInteractionHelpers(
  harness: DiscussionReportBatchHarness,
  DiscussionReportBatch: DiscussionReportBatchComponent,
) {
  type Element = FlatTestElement;

  function render(locale: "ru" | "en" = "en", allowActions = true, publication = false) {
    harness.cursor = 0;
    return flattenReactTestTree(
      DiscussionReportBatch({
        contentId: "post",
        commentId: publication ? null : "comment",
        items,
        locale,
        allowActions,
      }),
    );
  }

  const button = findTestButton;

  function click(nodes: Element[], label: string) {
    return (button(nodes, label).props.onClick as () => void)();
  }

  function acknowledgeBatchCommit(nodes: Element[]) {
    const checkbox = nodes.find(
      (node) =>
        node.type === "input" &&
        node.props.type === "checkbox" &&
        typeof node.props.id === "string" &&
        (node.props.id.includes("batch-commit") ||
          node.props.id.startsWith("discussion-report-batch-commit-")),
    );
    if (!checkbox) throw Error("Missing batch commit acknowledgement");
    (checkbox.props.onChange as (event: { target: { checked: boolean } }) => void)({
      target: { checked: true },
    });
  }

  async function commitBatch(renderFn: () => Element[], label: string) {
    acknowledgeBatchCommit(renderFn());
    await (button(renderFn(), label).props.onClick as () => Promise<void>)();
  }

  function select(locale: "ru" | "en" = "en", publication = false) {
    const copy = reportBatchCopy(locale);
    click(render(locale, true, publication), copy.selectAll);
    const textarea = render(locale, true, publication).find((node) => node.type === "textarea");
    if (!textarea) throw Error("Missing notes");
    (textarea.props.onChange as (event: unknown) => void)({ target: { value: "Recorded reason" } });
  }

  function chooseAction(
    action: "review" | "resolve" | "dismiss",
    locale: "ru" | "en" = "en",
    publication = false,
  ) {
    const field = render(locale, true, publication).find((node) => node.type === "select");
    if (!field) throw Error("Missing decision select");
    (field.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: action },
    });
  }

  async function review(locale: "ru" | "en" = "en", action: "resolve" | "dismiss" = "resolve") {
    select(locale);
    if (action !== "resolve") chooseAction(action, locale);
    if (action === "dismiss") {
      const dismissPreview = {
        ...preview,
        action: "dismiss" as const,
        items: preview.items.map((item) => ({ ...item, after: "dismissed" as const })),
      };
      harness.fetch
        .mockReset()
        .mockImplementation((url: string) =>
          Promise.resolve(response(url.endsWith("/preview") ? dismissPreview : ack)),
        );
    }
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
    harness.confirm.mockResolvedValue(true);
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

  return {
    render,
    button,
    click,
    acknowledgeBatchCommit,
    commitBatch,
    select,
    chooseAction,
    review,
  };
}
