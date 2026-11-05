import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
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
import { type FlatTestElement, flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const revision = "2026-10-11T00:00:00.123456Z",
  next = "2026-10-11T00:00:00.123457Z";
type Element = FlatTestElement;
function render(locale: "en" | "ru" = "en", organizationId?: string, serverId?: string) {
  harness.cursor = 0;
  return flattenReactTestTree(
    AuthorPublicationRestore({ id: "article", revision, locale, organizationId, serverId }),
  );
}
function button(nodes: Element[], label: string) {
  const element = nodes.find((node) => node.type === "button" && node.props.children === label);
  if (!element) throw Error(`Missing ${label}`);
  return element;
}
function click(nodes: Element[], label: string) {
  return (button(nodes, label).props.onClick as () => void)();
}
function errorState(nodes: Element[]) {
  return nodes.find(
    (node) =>
      typeof node.type !== "string" && (node.type as { name?: string }).name === "ErrorState",
  );
}
function hasErrorAlert(nodes: Element[], title?: string) {
  const state = errorState(nodes);
  if (!state || typeof state.props.title !== "string") return false;
  if (title !== undefined && state.props.title !== title) return false;
  return nodes.some((node) => node.props.role === "alert");
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.cleanups = [];
  confirmAction.mockReset().mockResolvedValue(true);
  harness.fetch
    .mockReset()
    .mockResolvedValue(response({ id: "article", status: "draft", revision: next }));
  vi.stubGlobal("fetch", harness.fetch);
  vi.stubGlobal("window", { location: { reload: harness.reload } });
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
    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ consequences: copy.restoreConfirm }),
    );
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
  confirmAction.mockResolvedValueOnce(false);
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
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));
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
  await vi.waitFor(() => expect(hasErrorAlert(render())).toBe(true));
  expect(typeof errorState(render())?.props.title).toBe("string");
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(button(render(), copy.restore).props.disabled).toBe(true);
  click(render(), copy.restore);
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  click(render(), copy.reload);
  expect(harness.refresh).toHaveBeenCalledTimes(1);
});
it.each(["CONFLICT", "FORBIDDEN", "PUBLICATION_RESTORE_DENIED"])(
  "shows a safe localized recovery error for %s without retrying the stale version",
  async (code) => {
    harness.fetch.mockResolvedValue(
      response({ code, error: "PRIVATE_DATABASE_DETAILS" }, code === "CONFLICT" ? 409 : 403),
    );
    const copy = authorPublicationDeskCopy("ru");
    click(render("ru"), copy.restore);
    await vi.waitFor(() => expect(hasErrorAlert(render("ru"))).toBe(true));
    const alert = errorState(render("ru"));
    expect(alert?.props.title).toBeTruthy();
    expect(String(alert?.props.title)).not.toContain("PRIVATE_DATABASE_DETAILS");
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
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));
  const signal = harness.fetch.mock.calls[0][1].signal;
  for (const cleanup of harness.cleanups.splice(0)) cleanup();
  expect(signal.aborted).toBe(true);
  finish(response({ id: "article", status: "draft", revision: next }));
  await new Promise((resolve) => setImmediate(resolve));
  expect(harness.refresh).not.toHaveBeenCalled();
});

it.each(["ru", "en"] as const)(
  "restores a team archive with a scope-bound acknowledgement in %s",
  async (locale) => {
    const { organizationPublicationHistoryCopy } = await import(
      "../apps/web/src/lib/organization-publication-history-copy"
    );
    const copy = organizationPublicationHistoryCopy(locale),
      labels = authorPublicationDeskCopy(locale);
    harness.fetch.mockResolvedValue(
      response({ id: "article", organizationId: "org", status: "draft", revision: next }),
    );
    click(render(locale, "org"), labels.restore);
    await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ consequences: copy.restoreConfirm }),
    );
    expect(harness.fetch.mock.calls[0][0]).toBe(
      "/api/workspace/organizations/org/content/article/restore",
    );
    expect(render(locale, "org").some((node) => node.props.children === copy.restoredNotice)).toBe(
      true,
    );
    expect(
      render(locale, "org").some(
        (node) => node.props.href === "/workspace/organizations/org/content/article",
      ),
    ).toBe(true);
  },
);
it.each(["foreign", undefined])(
  "blocks retry after mismatched organization acknowledgement (%s)",
  async (organizationId) => {
    harness.fetch.mockResolvedValue(
      response({ id: "article", organizationId, status: "draft", revision: next }),
    );
    const copy = authorPublicationDeskCopy("en");
    click(render("en", "org"), copy.restore);
    await vi.waitFor(() => expect(hasErrorAlert(render("en", "org"), copy.uncertain)).toBe(true));
    expect(errorState(render("en", "org"))?.props.title).toBe(copy.uncertain);
    expect(harness.refresh).not.toHaveBeenCalled();
    expect(button(render("en", "org"), copy.restore).props.disabled).toBe(true);
    click(render("en", "org"), copy.restore);
    expect(harness.fetch).toHaveBeenCalledTimes(1);
  },
);

it.each(["ru", "en"] as const)(
  "restores an exact server archive to a confirmed draft in %s",
  async (locale) => {
    const { serverPublicationHistoryCopy } = await import(
      "../apps/web/src/lib/server-publication-history-copy"
    );
    const copy = serverPublicationHistoryCopy(locale),
      labels = authorPublicationDeskCopy(locale);
    harness.fetch.mockResolvedValue(
      response({ id: "article", serverId: "srv", status: "draft", revision: next }),
    );
    click(render(locale, undefined, "srv"), labels.restore);
    await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
    expect(harness.fetch.mock.calls[0][0]).toBe(
      "/api/workspace/servers/srv/content/article/restore",
    );
    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ consequences: copy.restoreConfirm }),
    );
    expect(
      render(locale, undefined, "srv").some((node) => node.props.children === copy.restoredNotice),
    ).toBe(true);
    expect(
      render(locale, undefined, "srv").some(
        (node) => node.props.href === "/workspace/servers/srv/content/article",
      ),
    ).toBe(true);
  },
);
it("requires reload on a scope-mismatched server restore acknowledgement", async () => {
  harness.fetch.mockResolvedValue(
    response({ id: "article", serverId: "foreign", status: "draft", revision: next }),
  );
  const copy = authorPublicationDeskCopy("en");
  click(render("en", undefined, "srv"), copy.restore);
  await vi.waitFor(() =>
    expect(hasErrorAlert(render("en", undefined, "srv"), copy.uncertain)).toBe(true),
  );
  expect(errorState(render("en", undefined, "srv"))?.props.title).toBe(copy.uncertain);
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(button(render("en", undefined, "srv"), copy.restore).props.disabled).toBe(true);
});
