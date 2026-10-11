import { beforeEach, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  refresh: vi.fn(),
  fetch: vi.fn(),
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
        harness.slots[index] = value;
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
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }),
}));
import { getDictionary } from "../apps/web/src/lib/i18n";
import { ContentModerationControls } from "../apps/web/src/components/content-moderation-controls";
const previous = "2026-10-11T00:00:00.000Z";
const ack = {
  id: "post",
  action: "publish",
  status: "published",
  updatedAt: "2026-10-11T00:00:01.000Z",
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
type Element = ReactElement<Record<string, unknown>>;
function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...descendants(element.props.children as ReactNode)];
}
function render(workspace = true) {
  harness.cursor = 0;
  return descendants(
    ContentModerationControls({
      contentId: "post",
      expectedUpdatedAt: previous,
      status: "draft",
      workspace,
    }),
  );
}
function button(nodes: Element[], label: string) {
  const node = nodes.find(
    (node) =>
      node.type === "button" &&
      (Array.isArray(node.props.children)
        ? node.props.children.includes(label)
        : node.props.children === label),
  );
  if (!node) throw Error(`Missing button ${label}`);
  return node;
}
function click(nodes: Element[], label: string) {
  (button(nodes, label).props.onClick as () => void)();
}
function ready(workspace = true) {
  const field = render(workspace).find((node) => node.type === "textarea");
  if (!field) throw Error("Missing reason field");
  (field.props.onChange as (event: { target: { value: string } }) => void)({
    target: { value: "Reviewed reason" },
  });
  const nodes = render(workspace);
  expect(button(nodes, "Publish").props.disabled).toBe(false);
  return nodes;
}
beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.cleanups = [];
  harness.confirm.mockReturnValue(true);
  harness.fetch.mockResolvedValue(response(ack));
  vi.stubGlobal("fetch", harness.fetch);
  vi.stubGlobal("window", { confirm: harness.confirm, location: { reload: harness.reload } });
});
it("submits only observed publication fields, saves a confirmed revision and blocks a second decision", async () => {
  click(ready(), "Publish");
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
  const [url, init] = harness.fetch.mock.calls[0];
  expect(url).toBe("/api/admin/community/post");
  expect(JSON.parse(init.body)).toEqual({
    action: "publish",
    notes: "Reviewed reason",
    expectedUpdatedAt: previous,
  });
  expect(init).toMatchObject({ method: "POST", credentials: "same-origin", cache: "no-store" });
  expect(init.signal).toBeInstanceOf(AbortSignal);
  const nodes = render();
  expect(nodes.some((node) => node.props.role === "status")).toBe(true);
  expect(button(nodes, "Publish").props.disabled).toBe(true);
  click(nodes, "Archive");
  expect(harness.fetch).toHaveBeenCalledTimes(1);
});
it("guards duplicate clicks while the request is pending and lets cancellation leave the controls ready", async () => {
  harness.confirm.mockReturnValueOnce(false);
  const nodes = ready();
  click(nodes, "Publish");
  expect(harness.fetch).not.toHaveBeenCalled();
  let complete!: (value: Response) => void;
  harness.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  click(nodes, "Publish");
  click(nodes, "Publish");
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(render()[0].props["aria-busy"]).toBe(true);
  complete(response(ack));
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
});
it.each([
  [response({ ...ack, id: "foreign" }), "could not be confirmed"],
  [response({ ...ack, updatedAt: previous }), "could not be confirmed"],
  [response({ code: "CONTENT_STATE_CHANGED" }, 409), "publication changed"],
  [new Response("malformed", { status: 200 }), "could not be confirmed"],
])("blocks uncertain/conflicting replies until saved state is reloaded", async (reply, message) => {
  harness.fetch.mockResolvedValueOnce(reply);
  click(ready(), "Publish");
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  const nodes = render(),
    alert = nodes.find((node) => node.props.role === "alert");
  expect(alert?.props.children).toContain(message);
  expect(harness.refresh).not.toHaveBeenCalled();
  click(nodes, "Archive");
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  click(nodes, "Reload saved version");
  expect(harness.reload).toHaveBeenCalledTimes(1);
});
it("blocks network failures without success or refresh", async () => {
  harness.fetch.mockRejectedValueOnce(new Error("offline"));
  click(ready(), "Publish");
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(button(render(), "Publish").props.disabled).toBe(true);
});
it("aborts an unmounted request and ignores its eventual acknowledgement", async () => {
  let complete!: (value: Response) => void;
  harness.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  click(ready(), "Publish");
  for (const cleanup of harness.cleanups) cleanup();
  expect(harness.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  const json = vi.fn().mockResolvedValue(ack);
  complete({ ok: true, json } as unknown as Response);
  await vi.waitFor(() => expect(json).toHaveBeenCalledTimes(1));
  await Promise.resolve();
  expect(harness.refresh).not.toHaveBeenCalled();
});
it("preserves the existing admin action contract and requires its exact acknowledgement", async () => {
  harness.fetch.mockResolvedValueOnce(
    response({ success: true, targetId: "post", action: "publish" }),
  );
  click(ready(false), "Publish");
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
  const [url, init] = harness.fetch.mock.calls[0];
  expect(url).toBe("/api/admin/actions");
  expect(JSON.parse(init.body)).toEqual({
    targetType: "content",
    targetId: "post",
    action: "publish",
    notes: "Reviewed reason",
    expectedUpdatedAt: previous,
  });
});
