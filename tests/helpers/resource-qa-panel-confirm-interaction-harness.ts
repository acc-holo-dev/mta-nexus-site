import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";

export type ResourceQaPanelConfirmHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
};

type Element = ReactElement<Record<string, unknown>>;

export type ResourceQaPanelComponent = (props: {
  productId: string;
  locale: "en" | "ru";
  authenticated: boolean;
  canManage: boolean;
  builds: unknown[];
  initial: typeof page;
}) => ReactNode;

export type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const productId = "prd_aaaaaaaaaaaaaaaaaaaaaaaa";
export const threadId = "rqa_thread";
export const answerId = "rqa_answer";

const capabilities = {
  canAsk: false,
  canAnswer: true,
  canResolve: true,
  askReason: "ok" as const,
};

export const openDetail = {
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

export const resolvedDetail = {
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

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for resource QA confirm suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ResourceQaPanelConfirmHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
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
  });
}

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

function seed(
  harness: ResourceQaPanelConfirmHarness,
  detail: typeof openDetail | typeof resolvedDetail,
) {
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

export function createResourceQaPanelConfirmInteractionHelpers(
  harness: ResourceQaPanelConfirmHarness,
  ResourceQaPanel: ResourceQaPanelComponent,
  confirmAction: ConfirmActionMock,
) {
  function render(detail: typeof openDetail | typeof resolvedDetail) {
    seed(harness, detail);
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

  return { render, control };
}
