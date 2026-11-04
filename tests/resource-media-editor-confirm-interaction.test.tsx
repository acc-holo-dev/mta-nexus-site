import type { ManagedResourceMedia } from "@nexus/domain";
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
    // Abort cleanup is out of scope for confirm coverage.
  },
}));

import { ResourceMediaEditor } from "../apps/web/src/components/resource-media-editor";
import { resourceMediaCopy } from "../apps/web/src/lib/resource-media-i18n";

type Element = ReactElement<Record<string, unknown>>;

const initial: ManagedResourceMedia = {
  product: {
    id: "prd_aaaaaaaaaaaaaaaaaaaaaaaa",
    title: "Race kit",
    status: "draft",
    updatedAt: "2026-10-11T00:00:00.000Z",
  },
  items: [
    {
      id: "rmi_aaaaaaaaaaaaaaaaaaaaaaaa",
      caption: "Front cover",
      position: 0,
      width: 1280,
      height: 720,
      url: "/api/resource-media/rmi_aaaaaaaaaaaaaaaaaaaaaaaa",
    },
  ],
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

function seed() {
  // current, items, busy, message, error, abort ref, inFlight ref
  harness.slots = [initial, initial.items, false, "", "", { current: null }, { current: false }];
}

function render() {
  harness.cursor = 0;
  return descendants(ResourceMediaEditor({ initial, locale: "en" }));
}

function removeButton(nodes: Element[]) {
  const copy = resourceMediaCopy("en");
  const found = nodes.find((node) => node.type === "button" && node.props.children === copy.remove);
  if (!found) throw new Error("Missing gallery remove control");
  return found;
}

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  harness.cursor = 0;
  seed();
  confirmAction.mockResolvedValue(true);
  harness.fetch.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("confirms gallery image removal before PATCH remove", async () => {
  const copy = resourceMediaCopy("en");
  const item = initial.items[0];
  harness.fetch.mockResolvedValueOnce(
    response({
      product: initial.product,
      items: [],
    }),
  );

  await (removeButton(render()).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.removeConfirmTitle,
    object: item.caption,
    consequences: copy.removeConfirm,
    confirmLabel: copy.confirm,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    `/api/products/${encodeURIComponent(initial.product.id)}/media`,
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({
        action: "remove",
        mediaId: item.id,
        expectedUpdatedAt: initial.product.updatedAt,
      }),
    }),
  );
});

it("keeps the gallery image when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await (removeButton(render()).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
});
