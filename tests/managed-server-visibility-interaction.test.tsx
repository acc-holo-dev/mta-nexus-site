import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  confirm: vi.fn(),
  reload: vi.fn(),
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
  useEffect: (effect: () => () => void) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) {
      harness.slots[index] = true;
      harness.cleanups.push(effect());
    }
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { ManagedServerVisibilityBatch } from "../apps/web/src/components/managed-server-visibility-batch";
import { serverWorkspaceCopy } from "../apps/web/src/lib/server-workspace-copy";

const time = "2026-10-12T00:00:00.123456Z",
  next = "2026-10-12T00:00:00.124456Z",
  token = "a".repeat(64);
const items = [
  { id: "a", name: "Personal", card: "Personal card" },
  { id: "b", name: "Team", card: "Team card" },
];
const preview = {
  visibility: "private",
  previewRevision: token,
  items: items.map((item) => ({
    id: item.id,
    name: item.name,
    status: "active",
    organization: item.id === "b",
    before: "public",
    after: "private",
    changed: true,
    revision: time,
  })),
};
const ack = {
  visibility: "private",
  previewRevision: token,
  items: items.map((item) => ({
    id: item.id,
    visibility: "private",
    changed: true,
    revision: next,
  })),
};
type Element = ReactElement<Record<string, unknown>>;
function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...descendants(element.props.children as ReactNode)];
}
function render(locale: "en" | "ru" = "en", rows = items) {
  harness.cursor = 0;
  return descendants(ManagedServerVisibilityBatch({ items: rows, locale }));
}
function button(nodes: Element[], label: string) {
  const node = nodes.find((node) => node.type === "button" && node.props.children === label);
  if (!node) throw Error(`Missing ${label}`);
  return node;
}
function click(nodes: Element[], label: string) {
  return (button(nodes, label).props.onClick as () => void)();
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function selected(locale: "en" | "ru" = "en") {
  click(render(locale), serverWorkspaceCopy(locale).selectAll);
}
async function review(locale: "en" | "ru" = "en") {
  selected(locale);
  click(render(locale), serverWorkspaceCopy(locale).preview);
  await vi.waitFor(() =>
    expect(
      render(locale).some((node) => node.props.children === serverWorkspaceCopy(locale).confirm),
    ).toBe(true),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.cleanups = [];
  vi.stubGlobal("fetch", harness.fetch);
  vi.stubGlobal("window", { location: { reload: harness.reload } });
  harness.fetch.mockResolvedValue(response(preview));
});
afterEach(() => {
  harness.cleanups.forEach((cleanup) => {
    cleanup?.();
  });
  vi.unstubAllGlobals();
});
it.each(["en", "ru"] as const)(
  "reviews, freezes and confirms only the selected server identities in %s",
  async (locale) => {
    await review(locale);
    const nodes = render(locale),
      copy = serverWorkspaceCopy(locale);
    expect(nodes.find((node) => node.type === "fieldset")?.props.disabled).toBe(true);
    expect(nodes.filter((node) => node.type === "input").every((node) => node.props.disabled)).toBe(
      true,
    );
    expect(harness.fetch.mock.calls[0][0]).toBe("/api/workspace/servers/visibility/preview");
    expect(JSON.parse(harness.fetch.mock.calls[0][1].body)).toEqual({
      serverIds: ["a", "b"],
      visibility: "private",
    });
    harness.fetch.mockResolvedValue(response(ack));
    click(nodes, copy.confirm);
    await vi.waitFor(() =>
      expect(render(locale).some((node) => node.props.children === copy.saved)).toBe(true),
    );
    expect(JSON.parse(harness.fetch.mock.calls[1][1].body)).toEqual({
      serverIds: ["a", "b"],
      visibility: "private",
      previewRevision: token,
    });
    expect(harness.refresh).toHaveBeenCalledOnce();
    expect(button(render(locale), copy.reload).props.disabled).not.toBe(true);
  },
);
it("cancels the reviewed selection before issuing a write", async () => {
  await review();
  click(render(), serverWorkspaceCopy("en").cancel);
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(render().find((node) => node.type === "fieldset")?.props.disabled).toBe(false);
});
it("bounds the selection to twenty, even when multiple old checkbox handlers fire before rerender", () => {
  const rows = Array.from({ length: 21 }, (_, i) => ({
    id: `s${i}`,
    name: `Server ${i}`,
    card: "card",
  }));
  const inputs = render("en", rows).filter((node) => node.type === "input");
  inputs.forEach((node) => {
    (node.props.onChange as () => void)();
  });
  const state = render("en", rows).filter((node) => node.type === "input");
  expect(state.filter((node) => node.props.checked)).toHaveLength(20);
  expect(state[20].props.disabled).toBe(true);
});
it("does not issue a command when all reviewed values already match", async () => {
  harness.fetch.mockResolvedValue(
    response({
      ...preview,
      items: preview.items.map((item) => ({ ...item, before: "private", changed: false })),
    }),
  );
  await review();
  const commit = button(render(), serverWorkspaceCopy("en").confirm);
  expect(commit.props.disabled).toBe(true);
  (commit.props.onClick as () => void)();
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(render().some((node) => node.props.children === serverWorkspaceCopy("en").noChanges)).toBe(
    true,
  );
});
it("coalesces repeated preview and confirmation clicks and blocks replay after confirmed success", async () => {
  let release: (value: Response) => void = () => {};
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  selected();
  const old = button(render(), serverWorkspaceCopy("en").preview);
  (old.props.onClick as () => void)();
  (old.props.onClick as () => void)();
  expect(harness.fetch).toHaveBeenCalledOnce();
  release(response(preview));
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.children === serverWorkspaceCopy("en").confirm)).toBe(
      true,
    ),
  );
  harness.fetch.mockResolvedValue(response(ack));
  const commit = button(render(), serverWorkspaceCopy("en").confirm);
  (commit.props.onClick as () => void)();
  (commit.props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledOnce());
  (commit.props.onClick as () => void)();
  expect(harness.fetch).toHaveBeenCalledTimes(2);
});
it.each(["foreign", "duplicate", "extra", "changed"])(
  "does not expose an active confirm action for a mismatched preview (%s)",
  async (kind) => {
    const data = structuredClone(preview);
    if (kind === "foreign") data.items[0].id = "foreign";
    if (kind === "duplicate") data.items[1] = data.items[0];
    if (kind === "changed") data.items[0].changed = false;
    harness.fetch.mockResolvedValue(
      response(kind === "extra" ? { ...data, ownerId: "private" } : data),
    );
    selected();
    click(render(), serverWorkspaceCopy("en").preview);
    await vi.waitFor(() =>
      expect(
        render().some((node) => node.props.children === serverWorkspaceCopy("en").unavailable),
      ).toBe(true),
    );
    expect(render().some((node) => node.props.children === serverWorkspaceCopy("en").confirm)).toBe(
      false,
    );
    expect(harness.fetch).toHaveBeenCalledOnce();
  },
);
it.each(["revision", "scope", "network"])(
  "requires full reload after an unconfirmed write and blocks retained handlers (%s)",
  async (kind) => {
    await review();
    const commit = button(render(), serverWorkspaceCopy("en").confirm);
    if (kind === "network") harness.fetch.mockRejectedValueOnce(Error("Private transport details"));
    else
      harness.fetch.mockResolvedValueOnce(
        response({
          ...ack,
          items: ack.items.map((item, i) => ({
            ...item,
            ...(i === 0 ? (kind === "revision" ? { revision: time } : { id: "foreign" }) : {}),
          })),
        }),
      );
    (commit.props.onClick as () => void)();
    await vi.waitFor(() =>
      expect(
        render().some((node) => node.props.children === serverWorkspaceCopy("en").uncertain),
      ).toBe(true),
    );
    (commit.props.onClick as () => void)();
    expect(harness.fetch).toHaveBeenCalledTimes(2);
    expect(harness.refresh).not.toHaveBeenCalled();
    expect(render().some((node) => String(node.props.children).includes("Private transport"))).toBe(
      false,
    );
    click(render(), serverWorkspaceCopy("en").reload);
    expect(harness.reload).toHaveBeenCalledOnce();
  },
);
it("shows a safe stale-review error and does not retry it automatically", async () => {
  await review();
  harness.fetch.mockResolvedValueOnce(
    response({ code: "SERVER_BATCH_CHANGED", error: "Sensitive server information" }, 409),
  );
  click(render(), serverWorkspaceCopy("en").confirm);
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.children === serverWorkspaceCopy("en").changed)).toBe(
      true,
    ),
  );
  expect(harness.fetch).toHaveBeenCalledTimes(2);
  expect(harness.refresh).not.toHaveBeenCalled();
});
it.each(["preview", "write"])(
  "aborts requests on navigation and ignores late %s acknowledgements",
  async (stage) => {
    if (stage === "write") await review();
    let release: (value: Response) => void = () => {};
    harness.fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    if (stage === "preview") {
      selected();
      click(render(), serverWorkspaceCopy("en").preview);
    } else click(render(), serverWorkspaceCopy("en").confirm);
    const signal = harness.fetch.mock.calls.at(-1)?.[1].signal as AbortSignal;
    harness.cleanups.forEach((cleanup) => {
      cleanup?.();
    });
    expect(signal.aborted).toBe(true);
    release(response(stage === "preview" ? preview : ack));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(harness.refresh).not.toHaveBeenCalled();
    expect(render().some((node) => node.props.children === serverWorkspaceCopy("en").saved)).toBe(
      false,
    );
  },
);
it("retains confirmed success if refreshing the page fails", async () => {
  await review();
  harness.refresh.mockImplementationOnce(() => {
    throw Error("Refresh failed");
  });
  harness.fetch.mockResolvedValueOnce(response(ack));
  click(render(), serverWorkspaceCopy("en").confirm);
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.children === serverWorkspaceCopy("en").saved)).toBe(
      true,
    ),
  );
  expect(
    render().some((node) => node.props.children === serverWorkspaceCopy("en").unavailable),
  ).toBe(true);
});
