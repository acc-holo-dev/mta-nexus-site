import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({
  confirmAction,
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
  useEffect: (effect: () => undefined | (() => void)) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) {
      harness.slots[index] = true;
      const cleanup = effect();
      if (cleanup) harness.cleanups.push(cleanup);
    }
  },
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href }, children),
  };
});
import { ResourceReviewEditor } from "../apps/web/src/components/resource-review-controls";
import { resourceReviewCopy } from "../apps/web/src/lib/resource-review-i18n";

const publishedReview = {
  text: "Solid resource review",
  rating: 5,
  status: "published" as const,
  revision: 2,
};

type Element = ReactElement<Record<string, unknown>>;
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
function button(nodes: Element[], label: string) {
  const found = nodes.find((node) => node.type === "button" && node.props.children === label);
  if (!found) throw Error(`Missing ${label}`);
  return found;
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.cleanups = [];
  confirmAction.mockResolvedValue(true);
  vi.stubGlobal("fetch", harness.fetch);
  harness.fetch.mockResolvedValue(response({}));
});
afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup();
  vi.unstubAllGlobals();
});

it("does not withdraw a resource review when confirmAction is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  harness.cursor = 0;
  const nodes = descendants(
    ResourceReviewEditor({
      productId: "prd_a",
      review: { text: publishedReview.text, rating: 5, status: "published", revision: 2 },
      canReview: false,
      locale: "en",
    }),
  );
  const copy = resourceReviewCopy("en");
  await (button(nodes, copy.withdraw).props.onClick as () => Promise<void>)();
  expect(confirmAction).toHaveBeenCalledWith(
    expect.objectContaining({
      title: copy.withdrawConfirmTitle,
      object: publishedReview.text,
      consequences: copy.withdrawConfirm,
      danger: true,
    }),
  );
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("withdraws a resource review only after confirmAction approves", async () => {
  harness.fetch.mockResolvedValueOnce(
    response({ id: "cmt_a", revision: 3, status: "withdrawn", action: "withdraw" }),
  );
  harness.cursor = 0;
  const nodes = descendants(
    ResourceReviewEditor({
      productId: "prd_a",
      review: { text: publishedReview.text, rating: 5, status: "published", revision: 2 },
      canReview: false,
      locale: "en",
    }),
  );
  const copy = resourceReviewCopy("en");
  await (button(nodes, copy.withdraw).props.onClick as () => Promise<void>)();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(harness.fetch.mock.calls[0][0]).toBe("/api/library/review/prd_a");
  expect(JSON.parse(String(harness.fetch.mock.calls[0][1]?.body))).toMatchObject({
    action: "withdraw",
    expectedRevision: 2,
  });
});
