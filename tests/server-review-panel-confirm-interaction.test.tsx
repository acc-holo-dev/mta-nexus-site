import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { findTestButton, flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));

vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) {
      harness.slots[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
    }
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
  useCallback: (fn: unknown) => fn,
  useEffect: () => {
    // Seeded mine/signedIn state covers withdraw confirm; skip visibility refresh.
  },
  useId: () => "server-review-status",
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/servers/demo",
  useRouter: () => ({ refresh: harness.refresh }),
}));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" as const }),
}));

import { ServerReviewPanel } from "../apps/web/src/components/server-review-panel";
import { serverReviewCopy } from "../apps/web/src/lib/server-review-i18n";

const serverId = "srv_demo";
const reviewText = "Solid community server";
const emptyPage = { reviews: [], total: 0, page: 1, totalPages: 1 };
const publishedMine = {
  review: {
    id: "cmt_server",
    text: reviewText,
    rating: 5,
    status: "published" as const,
    revision: 2,
    interactionSource: "follow" as const,
    moderationReason: null,
    author: { username: "alex", displayName: "Alex" },
  },
  canReview: false,
  eligibility: "ok",
};

function seedPublished() {
  // statusRef, page, unavailable, retrying, mine, signedIn, text, rating,
  // busy, message, confirmed, loginHref, registerHref
  harness.slots = [
    { current: null },
    emptyPage,
    false,
    false,
    publishedMine,
    true,
    reviewText,
    5,
    false,
    "",
    false,
    "/auth/login?next=%2Fservers%2Fdemo",
    "/auth/register?next=%2Fservers%2Fdemo",
  ];
}

function render() {
  seedPublished();
  harness.cursor = 0;
  return flattenReactTestTree(
    ServerReviewPanel({
      serverId,
      initialPage: emptyPage,
    }) as ReactNode,
  );
}

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  confirmAction.mockResolvedValue(true);
  harness.fetch.mockReset();
  harness.refresh.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("does not withdraw a server review when confirmAction is cancelled", async () => {
  const copy = serverReviewCopy("en");
  confirmAction.mockResolvedValueOnce(false);
  await (findTestButton(render(), copy.withdraw).props.onClick as () => Promise<void>)();
  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.withdrawConfirmTitle,
    object: reviewText,
    consequences: copy.withdrawConfirm,
    confirmLabel: copy.withdraw,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("withdraws a server review only after confirmAction approves", async () => {
  const copy = serverReviewCopy("en");
  harness.fetch
    .mockResolvedValueOnce(
      response({ id: "cmt_server", revision: 3, status: "withdrawn", success: true }),
    )
    .mockResolvedValueOnce(response(emptyPage));

  await (findTestButton(render(), copy.withdraw).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.withdrawConfirmTitle,
    object: reviewText,
    consequences: copy.withdrawConfirm,
    confirmLabel: copy.withdraw,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch.mock.calls[0]?.[0]).toBe(`/api/servers/${serverId}/reviews`);
  expect(JSON.parse(String(harness.fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
    action: "withdraw",
    expectedRevision: 2,
  });
});
