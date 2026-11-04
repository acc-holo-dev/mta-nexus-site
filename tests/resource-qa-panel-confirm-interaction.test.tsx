import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [
      harness.slots[index],
      (value: unknown) => {
        harness.slots[index] =
          typeof value === "function"
            ? (value as (current: unknown) => unknown)(harness.slots[index])
            : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = { current: initial };
    return harness.slots[index];
  },
  useEffect: () => {
    // Detail state is seeded below; skip login-href bootstrap for confirm coverage.
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/market/example" }));

import { ResourceQaPanel } from "../apps/web/src/components/resource-qa-panel";
import { resourceQaCopy } from "../apps/web/src/lib/resource-qa-i18n";

type Element = ReactElement<Record<string, unknown>>;

const productId = "prd_aaaaaaaaaaaaaaaaaaaaaaaa";
const threadId = "rqa_thread";
const answerId = "rqa_answer";
const capabilities = {
  canAsk: false,
  canAnswer: true,
  canResolve: true,
  askReason: "ok" as const,
};

const openDetail = {
  thread: {
    id: threadId,
    body: "Does this work on 1.6?",
    status: "open" as const,
    revision: 2,
    answerCount: 1,
    buildContext: null,
    resolvedAnswerId: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: null,
    following: false,
    followRevision: 1,
    author: { username: "author", displayName: "Author" },
    answers: [
      {
        id: answerId,
        body: "Yes on 1.6.",
        status: "published" as const,
        revision: 1,
        isResolved: false,
        createdAt: new Date("2026-10-02T00:00:00.000Z"),
        updatedAt: null,
        author: { username: "owner", displayName: "Owner" },
      },
    ],
  },
  capabilities,
};

const resolvedDetail = {
  ...openDetail,
  thread: {
    ...openDetail.thread,
    status: "resolved" as const,
    resolvedAnswerId: answerId,
    answers: [{ ...openDetail.thread.answers[0], isResolved: true }],
  },
};

const page = {
  threads: [
    {
      id: threadId,
      body: openDetail.thread.body,
      status: "open" as const,
      revision: 2,
      answerCount: 1,
      buildContext: null,
      resolvedAnswerId: null,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      updatedAt: null,
      author: { username: "author", displayName: "Author" },
    },
  ],
  capabilities,
};

function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  const type = element.type as { displayName?: string } | string;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [
      { ...element, type: "button" } as Element,
      ...descendants(element.props.children as ReactNode),
    ];
  }
  return [element, ...descendants(element.props.children as ReactNode)];
}

function seed(detail: typeof openDetail | typeof resolvedDetail) {
  // page, readError, selectedId, pendingThreadId, detail, loadingDetail, loadingPage,
  // question, buildId, answer, writeError, busy, loginHref, registerHref, writeGuard
  harness.slots = [
    page,
    "",
    threadId,
    threadId,
    detail,
    false,
    false,
    "",
    "",
    "",
    "",
    false,
    "/auth/login?next=%2Fmarket%2Fexample",
    "/auth/register?next=%2Fmarket%2Fexample",
    { current: false },
  ];
}

function render(detail: typeof openDetail | typeof resolvedDetail) {
  seed(detail);
  harness.cursor = 0;
  return descendants(
    ResourceQaPanel({
      productId,
      locale: "en",
      authenticated: true,
      canManage: true,
      builds: [],
      initial: page,
    }),
  );
}

function control(nodes: Element[], label: string) {
  const found = nodes.find((node) => node.type === "button" && node.props.children === label);
  if (!found) throw new Error(`Missing ${label}`);
  return found;
}

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  confirmAction.mockResolvedValue(true);
  harness.fetch.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("confirms resolve before posting the useful-answer write", async () => {
  const copy = resourceQaCopy("en");
  harness.fetch
    .mockResolvedValueOnce(response({ success: true, status: "resolved" }))
    .mockResolvedValueOnce(response(resolvedDetail));

  await (control(render(openDetail), copy.resolve).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.resolveConfirmTitle,
    object: openDetail.thread.body,
    consequences: copy.resolveConfirm,
    confirmLabel: copy.resolve,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: false,
  });
  expect(harness.fetch.mock.calls[0]?.[0]).toBe(
    `/api/products/${productId}/qa/${encodeURIComponent(threadId)}/resolve`,
  );
  expect(harness.fetch.mock.calls[0]?.[1]).toMatchObject({
    method: "POST",
    body: JSON.stringify({
      action: "resolve",
      answerId,
      expectedRevision: openDetail.thread.revision,
    }),
  });
});

it("skips resolve when confirmation is cancelled", async () => {
  const copy = resourceQaCopy("en");
  confirmAction.mockResolvedValueOnce(false);
  await (control(render(openDetail), copy.resolve).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("confirms reopen before posting the reopen write", async () => {
  const copy = resourceQaCopy("en");
  harness.fetch
    .mockResolvedValueOnce(response({ success: true, status: "open" }))
    .mockResolvedValueOnce(response(openDetail));

  await (control(render(resolvedDetail), copy.reopen).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.reopenConfirmTitle,
    object: resolvedDetail.thread.body,
    consequences: copy.reopenConfirm,
    confirmLabel: copy.reopen,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch.mock.calls[0]?.[0]).toBe(
    `/api/products/${productId}/qa/${encodeURIComponent(threadId)}/resolve`,
  );
  expect(harness.fetch.mock.calls[0]?.[1]).toMatchObject({
    method: "POST",
    body: JSON.stringify({
      action: "reopen",
      expectedRevision: resolvedDetail.thread.revision,
    }),
  });
});

it("skips reopen when confirmation is cancelled", async () => {
  const copy = resourceQaCopy("en");
  confirmAction.mockResolvedValueOnce(false);
  await (control(render(resolvedDetail), copy.reopen).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
});
