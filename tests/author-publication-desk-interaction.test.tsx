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

import { AuthorPublicationRestore } from "../apps/web/src/components/author-publication-restore";
import { authorPublicationDeskCopy } from "../apps/web/src/lib/author-publication-desk-copy";

const revision = "2026-10-11T00:00:00.123456Z",
  next = "2026-10-11T00:00:00.123457Z";
type Element = ReactElement<Record<string, unknown>>;
function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...descendants(element.props.children as ReactNode)];
}
function render(locale: "en" | "ru" = "en") {
  harness.cursor = 0;
  return descendants(AuthorPublicationRestore({ id: "article", revision, locale }));
}
function button(nodes: Element[], label: string) {
  const element = nodes.find((node) => node.type === "button" && node.props.children === label);
  if (!element) throw Error(`Missing ${label}`);
  return element;
}
function click(nodes: Element[], label: string) {
  return (button(nodes, label).props.onClick as () => void)();
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.cleanups = [];
  harness.confirm.mockReturnValue(true);
  harness.fetch
    .mockReset()
    .mockResolvedValue(response({ id: "article", status: "draft", revision: next }));
  vi.stubGlobal("fetch", harness.fetch);
  vi.stubGlobal("window", { confirm: harness.confirm, location: { reload: harness.reload } });
});
afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup();
  vi.unstubAllGlobals();
});
it.each(["en", "ru"] as const)(
  "restores the exact observed version and refreshes history only after a strict draft acknowledgement in %s",
  async (locale) => {
    const copy = authorPublicationDeskCopy(locale);
    click(render(locale), copy.restore);
    await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
    expect(harness.confirm).toHaveBeenCalledWith(copy.restoreConfirm);
    const [url, init] = harness.fetch.mock.calls[0];
    expect(url).toBe("/api/workspace/content/article/restore");
    expect(init).toMatchObject({ method: "POST", cache: "no-store", credentials: "same-origin" });
    expect(JSON.parse(init.body)).toEqual({ expectedRevision: revision });
    expect(
      render(locale).some(
        (node) => node.props.role === "status" && node.props.children === copy.restoredNotice,
      ),
    ).toBe(true);
    expect(button(render(locale), copy.restore).props.disabled).toBe(true);
    expect(render(locale).some((node) => node.props.href === "/workspace/content/article")).toBe(
      true,
    );
  },
);
it("allows cancellation without sending a command", () => {
  harness.confirm.mockReturnValue(false);
  click(render(), authorPublicationDeskCopy("en").restore);
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(button(render(), authorPublicationDeskCopy("en").restore).props.disabled).toBe(false);
});
it("coalesces rapid commands while the first exact-version write is pending", async () => {
  let finish!: (reply: Response) => void;
  harness.fetch.mockReset().mockReturnValue(
    new Promise<Response>((resolve) => {
      finish = resolve;
    }),
  );
  const nodes = render();
  click(nodes, authorPublicationDeskCopy("en").restore);
  click(nodes, authorPublicationDeskCopy("en").restore);
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(render()[0].props["aria-busy"]).toBe(true);
  finish(response({ id: "article", status: "draft", revision: next }));
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
});
it.each([
  { id: "foreign", status: "draft", revision: next },
  { id: "article", status: "published", revision: next },
  { id: "article", status: "draft", revision },
  { id: "article", status: "draft", revision: next, body: "extra-private-data" },
  null,
])("requires a saved-state reload after an uncertain acknowledgement %j", async (reply) => {
  harness.fetch.mockResolvedValue(response(reply));
  const copy = authorPublicationDeskCopy("en");
  click(render(), copy.restore);
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(button(render(), copy.restore).props.disabled).toBe(true);
  click(render(), copy.restore);
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  click(render(), copy.reload);
  expect(harness.reload).toHaveBeenCalledTimes(1);
});
it.each(["CONFLICT", "FORBIDDEN", "PUBLICATION_RESTORE_DENIED"])(
  "shows a safe localized recovery error for %s without retrying the stale version",
  async (code) => {
    harness.fetch.mockResolvedValue(
      response({ code, error: "PRIVATE_DATABASE_DETAILS" }, code === "CONFLICT" ? 409 : 403),
    );
    const copy = authorPublicationDeskCopy("ru");
    click(render("ru"), copy.restore);
    await vi.waitFor(() =>
      expect(render("ru").some((node) => node.props.role === "alert")).toBe(true),
    );
    const alert = render("ru").find((node) => node.props.role === "alert");
    expect(alert?.props.children).not.toContain("PRIVATE_DATABASE_DETAILS");
    expect(button(render("ru"), copy.restore).props.disabled).toBe(true);
    expect(harness.refresh).not.toHaveBeenCalled();
  },
);
it("aborts on navigation and ignores late confirmation", async () => {
  let finish!: (reply: Response) => void;
  harness.fetch.mockReset().mockReturnValue(
    new Promise<Response>((resolve) => {
      finish = resolve;
    }),
  );
  click(render(), authorPublicationDeskCopy("en").restore);
  const signal = harness.fetch.mock.calls[0][1].signal;
  for (const cleanup of harness.cleanups.splice(0)) cleanup();
  expect(signal.aborted).toBe(true);
  finish(response({ id: "article", status: "draft", revision: next }));
  await new Promise((resolve) => setImmediate(resolve));
  expect(harness.refresh).not.toHaveBeenCalled();
});
