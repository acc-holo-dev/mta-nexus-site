import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as Array<undefined | (() => void)>,
  fetch: vi.fn(),
  actorId: "actor",
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
  useEffect: (effect: () => undefined | (() => void), deps: unknown[]) => {
    const index = harness.cursor++;
    const previous = harness.slots[index] as unknown[] | undefined;
    if (
      !previous ||
      previous.length !== deps.length ||
      deps.some((value, i) => value !== previous[i])
    ) {
      harness.slots[index] = deps;
      const cleanup = effect();
      if (cleanup) harness.cleanups.push(cleanup);
    }
  },
}));

import { ReactionRemoval } from "../apps/web/src/components/reaction-removal";
import { reactionCopy } from "../apps/web/src/lib/content-reaction-copy";

type Element = ReactElement<Record<string, unknown>>;

function componentName(type: Element["type"]): string | undefined {
  if (typeof type === "string") return type;
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name;
  }
  if (typeof type === "object" && type !== null) {
    return (type as { displayName?: string }).displayName;
  }
  return undefined;
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

function findNamed(nodes: Element[], name: string) {
  const found = nodes.find((node) => componentName(node.type) === name);
  if (!found) throw new Error(`Missing ${name}`);
  return found;
}

function render() {
  harness.cursor = 0;
  return descendants(
    ReactionRemoval({
      contentId: "content_aaaaaaaaaaaaaaaaaaaaaa",
      actorId: harness.actorId,
      reloadHref: "/workspace/reactions",
      locale: "en",
    }),
  );
}

function removeButton(nodes: Element[]) {
  const copy = reactionCopy("en");
  const found = nodes.find((node) => node.type === "button" && node.props.children === copy.remove);
  if (!found) throw new Error("Missing remove control");
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
  harness.fetch.mockReset();
  harness.actorId = "actor";
  vi.stubGlobal("fetch", harness.fetch);
});

afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup?.();
  vi.unstubAllGlobals();
});

it("confirms workspace reaction removal before DELETE", async () => {
  const copy = reactionCopy("en");
  const contentId = "content_aaaaaaaaaaaaaaaaaaaaaa";
  harness.fetch.mockResolvedValueOnce(response({ contentId, removed: true, actorId: "actor" }));

  await (removeButton(render()).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.removeConfirmTitle,
    object: contentId,
    consequences: copy.removeConfirm,
    confirmLabel: copy.remove,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    `/api/workspace/reactions/${encodeURIComponent(contentId)}`,
    expect.objectContaining({ method: "DELETE" }),
  );
});

it("keeps the workspace reaction when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await (removeButton(render()).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("routes blocked removal failures through ErrorState", async () => {
  const copy = reactionCopy("en");
  harness.fetch.mockResolvedValueOnce(response({ code: "FORBIDDEN" }, 403));

  await (removeButton(render()).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(findNamed(render(), "ErrorState")).toBeDefined());

  expect(findNamed(render(), "ErrorState").props.title).toBeTruthy();
  expect(render().some((node) => node.props.role === "alert" && node.type === "p")).toBe(false);
  expect(render().some((node) => node.props.children === copy.removed)).toBe(false);
});

it("does not apply a delayed removal response to another account", async () => {
  let complete!: (value: Response) => void;
  harness.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  const pending = (removeButton(render()).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledOnce());
  expect(
    (harness.fetch.mock.calls[0][1].headers as Record<string, string>)["x-nexus-actor-id"],
  ).toBe("actor");
  harness.actorId = "other";
  render();
  complete(
    response({ contentId: "content_aaaaaaaaaaaaaaaaaaaaaa", removed: true, actorId: "actor" }),
  );
  await pending;
  expect(render().some((node) => node.props.children === reactionCopy("en").removed)).toBe(false);
});
