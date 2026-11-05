import type { ReactElement, ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

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
    const i = harness.cursor++,
      old = harness.slots[i] as unknown[] | undefined;
    if (!old || old.length !== deps.length || deps.some((value, index) => value !== old[index])) {
      harness.slots[i] = deps;
      const cleanup = effect();
      if (cleanup) harness.cleanups.push(cleanup);
    }
  },
}));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
  LocaleProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/saved",
}));

import { FollowButton } from "../apps/web/src/components/follow-button";
import { followActionCopy, followCopy } from "../apps/web/src/lib/follow-workspace-copy";

type Element = ReactElement<Record<string, unknown>>;
const initial = { authenticated: true, actorId: "usr_1", following: true };
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
function render(locale: "ru" | "en" = "en") {
  harness.cursor = 0;
  const wrapper = FollowButton({
    targetType: "user",
    targetId: "member",
    targetName: "Member",
    initial,
    locale,
  });
  const control = wrapper.props.children as ReactElement;
  return descendants((control.type as (props: unknown) => ReactNode)(control.props));
}
function toggle(nodes: Element[]) {
  const element = nodes.find((node) => node.type === "button" && node.props["aria-label"]);
  if (!element) throw Error("Missing follow control");
  return element;
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
beforeEach(() => {
  vi.resetAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.cleanups = [];
  confirmAction.mockResolvedValue(true);
  vi.stubGlobal("fetch", harness.fetch);
});
it.each(["en", "ru"] as const)(
  "asks for confirmation before unfollow DELETE in %s",
  async (locale) => {
    const shared = followCopy(locale),
      action = followActionCopy(locale, "user");
    harness.fetch.mockResolvedValueOnce(
      response({
        success: true,
        following: false,
        targetType: "user",
        targetId: "member",
      }),
    );
    await (toggle(render(locale)).props.onClick as () => Promise<void>)();
    expect(confirmAction).toHaveBeenCalledWith({
      title: shared.removeConfirmTitle,
      object: "Member",
      consequences: shared.removeConfirm,
      confirmLabel: action.unfollow,
      cancelLabel: shared.cancel,
      closeLabel: shared.cancel,
    });
    expect(harness.fetch).toHaveBeenCalledOnce();
    expect(harness.fetch.mock.calls[0][1]).toMatchObject({ method: "DELETE" });
  },
);
it("skips unfollow when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await (toggle(render()).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(toggle(render()).props["aria-pressed"]).toBe(true);
});

it("binds the displayed account to the unfollow request after an account switch", async () => {
  harness.fetch.mockResolvedValueOnce(response({ code: "ACTOR_CHANGED" }, 409));
  await (toggle(render()).props.onClick as () => Promise<void>)();
  expect(JSON.parse(harness.fetch.mock.calls[0][1].body)).toMatchObject({
    expectedActorId: "usr_1",
  });
  expect(render().some((node) => node.props["aria-pressed"] === true)).toBe(false);
});
