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

import { FollowWorkspace } from "../apps/web/src/components/follow-workspace";
import type { FollowPage } from "../apps/web/src/lib/follow-workspace-contract";
import { followCopy } from "../apps/web/src/lib/follow-workspace-copy";

const initialPage: FollowPage = {
  items: [
    {
      id: "f",
      targetType: "organization",
      targetId: "org",
      notifyComments: false,
      createdAt: "2026-10-10T12:00:00.000Z",
      title: "Team",
      description: "Public organization",
      image: null,
      verified: true,
      href: "/organizations/team",
    },
  ],
  hasMore: false,
  nextCursor: null,
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
function render(locale: "en" | "ru" = "en") {
  harness.cursor = 0;
  return descendants(FollowWorkspace({ initial: initialPage, query: "", locale }));
}
function removeButton(nodes: Element[], locale: "en" | "ru") {
  const label = `${followCopy(locale).remove}: Team`;
  const found = nodes.find((node) => node.type === "button" && node.props["aria-label"] === label);
  if (!found) throw Error(`Missing remove control for ${locale}`);
  return found;
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const ack = {
  success: true,
  following: false,
  targetType: "organization",
  targetId: "org",
};
beforeEach(() => {
  vi.resetAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.cleanups = [];
  confirmAction.mockResolvedValue(true);
  vi.stubGlobal("fetch", harness.fetch);
});
afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup();
  vi.unstubAllGlobals();
});
it("does not delete a saved follow when removal is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await (removeButton(render(), "en").props.onClick as () => Promise<void>)();
  expect(confirmAction).toHaveBeenCalledWith(
    expect.objectContaining({
      title: followCopy("en").removeConfirmTitle,
      object: "Team",
      consequences: followCopy("en").removeConfirm,
    }),
  );
  expect(harness.fetch).not.toHaveBeenCalled();
});
it("deletes a saved follow only after confirmAction approves removal", async () => {
  harness.fetch.mockResolvedValueOnce(response(ack));
  await (removeButton(render(), "en").props.onClick as () => Promise<void>)();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(harness.fetch.mock.calls[0][0]).toBe("/api/follow");
  expect(harness.fetch.mock.calls[0][1]).toMatchObject({
    method: "DELETE",
    body: JSON.stringify({ targetType: "organization", targetId: "org" }),
  });
});
