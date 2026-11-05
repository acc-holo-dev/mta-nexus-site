import type { ReactElement, ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  actorId: "actor",
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = harness.cursor++;
    if (!(i in harness.slots)) harness.slots[i] = initial;
    return [
      harness.slots[i],
      (value: unknown) => {
        harness.slots[i] = typeof value === "function" ? value(harness.slots[i]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = harness.cursor++;
    if (!(i in harness.slots)) harness.slots[i] = { current: initial };
    return harness.slots[i];
  },
  useEffect: (effect: () => undefined | (() => void), deps: unknown[]) => {
    const i = harness.cursor++;
    const old = harness.slots[i] as unknown[] | undefined;
    if (!old || old.length !== deps.length || deps.some((value, index) => value !== old[index])) {
      harness.slots[i] = deps;
      const cleanup = effect();
      if (cleanup) harness.cleanups.push(cleanup);
    }
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/articles/guide" }));
vi.mock("next/link", () => ({ default: "a" }));

import { ContentReactions } from "../apps/web/src/components/content-reactions";
import { reactionCopy } from "../apps/web/src/lib/content-reaction-copy";

const saved = {
  contentId: "content",
  slug: "guide",
  authenticated: true,
  actorId: "actor",
  self: false,
  reaction: "thanks" as const,
  counts: { helpful: 2, thanks: 3, insight: 0 },
};

type Element = ReactElement<Record<string, unknown>>;

function buttons(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  const type = element.type as { displayName?: string } | string;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [{ ...element, type: "button" } as Element];
  }
  return buttons(element.props.children as ReactNode);
}

function render() {
  harness.cursor = 0;
  return buttons(
    ContentReactions({
      slug: "guide",
      contentId: "content",
      initial: { ...saved, actorId: harness.actorId },
      locale: "en",
    }),
  );
}

function removeButton(nodes: Element[]) {
  const button = nodes.find((node) => node.props.children === reactionCopy("en").remove);
  if (!button) throw new Error("missing remove control");
  return button;
}

beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.cleanups = [];
  harness.actorId = "actor";
  confirmAction.mockResolvedValue(true);
  vi.stubGlobal("fetch", harness.fetch);
});

it("confirms before clearing a reaction", async () => {
  const copy = reactionCopy("en");
  harness.fetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        contentId: "content",
        actorId: "actor",
        slug: "guide",
        reaction: null,
        counts: { helpful: 2, thanks: 2, insight: 0 },
        changed: true,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  await (removeButton(render()).props.onClick as () => Promise<void>)();
  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.removeConfirmTitle,
    object: copy.thanks,
    consequences: copy.removeConfirm,
    confirmLabel: copy.remove,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: false,
  });
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(harness.fetch.mock.calls[0]?.[1]).toMatchObject({
    method: "PUT",
    body: JSON.stringify({ reaction: null }),
  });
});

it("keeps the reaction when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await (removeButton(render()).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("does not apply a delayed public mutation after account changes", async () => {
  let complete!: (response: Response) => void;
  harness.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  const pending = (removeButton(render()).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledOnce());
  expect(harness.fetch.mock.calls[0][1].headers["x-nexus-actor-id"]).toBe("actor");
  harness.actorId = "other";
  render();
  complete(
    new Response(
      JSON.stringify({
        contentId: "content",
        actorId: "actor",
        slug: "guide",
        reaction: null,
        counts: { helpful: 2, thanks: 2, insight: 0 },
        changed: true,
      }),
      { status: 200 },
    ),
  );
  await pending;
  expect(removeButton(render())).toBeDefined();
});
