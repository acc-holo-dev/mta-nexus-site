import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
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

import { FollowButton } from "../apps/web/src/components/follow-button";
import { followCopy } from "../apps/web/src/lib/follow-workspace-copy";

type Element = ReactElement<Record<string, unknown>>;
const initial = { authenticated: true, following: false };
function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...descendants(element.props.children as ReactNode)];
}
function render(locale: "ru" | "en" = "en") {
  harness.cursor = 0;
  const wrapper = FollowButton({
    targetType: "content",
    targetId: "article",
    targetName: "Article",
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
const ack = { success: true, following: true, targetType: "content", targetId: "article" };
beforeEach(() => {
  vi.resetAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.cleanups = [];
  vi.stubGlobal("fetch", harness.fetch);
});
afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup();
  vi.unstubAllGlobals();
});
it.each(["en", "ru"] as const)(
  "saves a confirmed discussion subscription and then its removal in %s",
  async (locale) => {
    harness.fetch
      .mockResolvedValueOnce(response(ack))
      .mockResolvedValueOnce(response({ ...ack, following: false }));
    await (toggle(render(locale)).props.onClick as () => Promise<void>)();
    expect(toggle(render(locale)).props["aria-pressed"]).toBe(true);
    expect(harness.fetch.mock.calls[0][0]).toBe("/api/follow");
    expect(harness.fetch.mock.calls[0][1]).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ targetType: "content", targetId: "article" }),
    });
    await (toggle(render(locale)).props.onClick as () => Promise<void>)();
    expect(harness.fetch.mock.calls[1][1].method).toBe("DELETE");
    expect(toggle(render(locale)).props["aria-pressed"]).toBe(false);
    expect(render(locale).some((node) => node.props.role === "status")).toBe(true);
  },
);
it("blocks repeated clicks while a request is in flight", async () => {
  let resolve!: (value: Response) => void;
  harness.fetch.mockImplementation(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  const click = toggle(render()).props.onClick as () => Promise<void>;
  const write = click();
  await click();
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(toggle(render()).props.disabled).toBe(true);
  resolve(response(ack));
  await write;
});
it.each([
  [200, { ...ack, targetId: "foreign" }],
  [200, { ...ack, following: false }],
  [200, { success: true }],
  [503, { code: "INTERNAL_ERROR" }],
] as const)(
  "requires exact confirmed identity/state after status %s and prevents stale handler retries",
  async (status, body) => {
    harness.fetch.mockResolvedValue(response(body, status));
    const oldClick = toggle(render()).props.onClick as () => Promise<void>;
    await oldClick();
    await oldClick();
    expect(harness.fetch).toHaveBeenCalledOnce();
    expect(render().some((node) => node.props.role === "alert")).toBe(true);
    expect(render().some((node) => node.props["aria-pressed"] === true)).toBe(false);
  },
);
it("rechecks authoritative state after an uncertain write before allowing another action", async () => {
  harness.fetch.mockRejectedValueOnce(Error("network-private")).mockResolvedValueOnce(
    response({
      authenticated: true,
      following: true,
      targetType: "content",
      targetId: "article",
    }),
  );
  const click = toggle(render()).props.onClick as () => Promise<void>;
  await click();
  await click();
  expect(harness.fetch).toHaveBeenCalledOnce();
  const retry = render().find(
    (node) => node.type === "button" && node.props.children === followCopy("en").retry,
  );
  if (!retry) throw Error("Missing retry");
  (retry.props.onClick as () => void)();
  render();
  await new Promise((resolve) => setImmediate(resolve));
  expect(toggle(render()).props["aria-pressed"]).toBe(true);
  expect(harness.fetch.mock.calls[1][0]).toBe("/api/follow?targetType=content&targetId=article");
  harness.fetch.mockResolvedValueOnce(response({ ...ack, following: false }));
  await (toggle(render()).props.onClick as () => Promise<void>)();
  expect(harness.fetch.mock.calls[2][1].method).toBe("DELETE");
});
it("switches to sign in after session revocation and aborts the write on unmount", async () => {
  harness.fetch.mockResolvedValue(response({ code: "UNAUTHORIZED" }, 401));
  const click = toggle(render()).props.onClick as () => Promise<void>;
  await click();
  await click();
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(render().some((node) => node.props.href === "/auth/login")).toBe(true);
  for (const cleanup of harness.cleanups) cleanup();
  expect(harness.fetch.mock.calls[0][1].signal.aborted).toBe(true);
});
