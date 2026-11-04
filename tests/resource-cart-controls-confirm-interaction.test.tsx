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
    // Cart state is seeded below; skip abort cleanup registration for confirm coverage.
  },
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" as const }),
}));

import { ResourceCartControls } from "../apps/web/src/components/resource-cart-controls";
import { getResourceCommerceCopy } from "../apps/web/src/lib/resource-commerce-i18n";

type Element = ReactElement<Record<string, unknown>>;

const item = {
  productId: "prd_aaaaaaaaaaaaaaaaaaaaaaaa",
  title: "Sample Resource",
  slug: "sample-resource",
  version: "1.0.0",
  available: true,
  alreadyOwned: false,
};

const initialCart = { items: [item], limit: 20 };

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

function seedCart() {
  // cart, review, busy, error, receiptId, active ref, lock ref, pending ref
  harness.slots = [initialCart, null, false, "", null, { current: null }, { current: false }, { current: null }];
}

function render() {
  harness.cursor = 0;
  return descendants(ResourceCartControls({ initialCart }));
}

function removeButton(nodes: Element[]) {
  const copy = getResourceCommerceCopy("en");
  const found = nodes.find(
    (node) =>
      node.type === "button" &&
      node.props.children === copy.remove &&
      node.props["aria-label"] === `${copy.remove}: ${item.title}`,
  );
  if (!found) throw new Error("Missing cart remove button");
  return found;
}

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  harness.cursor = 0;
  seedCart();
  confirmAction.mockResolvedValue(true);
  harness.fetch.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("confirms cart item removal before DELETE", async () => {
  const copy = getResourceCommerceCopy("en");
  harness.fetch
    .mockResolvedValueOnce(response({ productId: item.productId, inCart: false }))
    .mockResolvedValueOnce(response({ items: [], limit: 20 }));

  (removeButton(render()).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.removeConfirmTitle,
    object: item.title,
    consequences: copy.removeConfirm,
    confirmLabel: copy.remove,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/resources/cart",
    expect.objectContaining({
      method: "DELETE",
      body: JSON.stringify({ productId: item.productId }),
    }),
  );
});

it("does not remove a cart item when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  (removeButton(render()).props.onClick as () => void)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(harness.fetch).not.toHaveBeenCalled();
});
