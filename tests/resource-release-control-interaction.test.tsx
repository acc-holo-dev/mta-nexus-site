import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  locale: "en",
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = initial;
    return [
      h.slots[i],
      (v: unknown) => {
        h.slots[i] = typeof v === "function" ? (v as (p: unknown) => unknown)(h.slots[i]) : v;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = { current: initial };
    return h.slots[i];
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: h.locale }),
}));
import { LibraryReleaseSelectionControls } from "../apps/web/src/components/library-release-selection-controls";
import { getResourceReleaseControlCopy } from "../apps/web/src/lib/resource-release-control-i18n";
type Element = ReactElement<Record<string, unknown>>;
function nodes(n: ReactNode): Element[] {
  if (Array.isArray(n)) return n.flatMap(nodes);
  if (!n || typeof n !== "object" || !("props" in n)) return [];
  const e = n as Element;
  return [e, ...nodes(e.props.children as ReactNode)];
}
function render() {
  h.cursor = 0;
  return nodes(
    LibraryReleaseSelectionControls({
      productId: "prd_a",
      revision: 3,
      mode: "fixed",
      selectedBuildId: "bld_old",
      versions: [
        { id: "bld_a", version: "2" },
        { id: "bld_b", version: "3" },
      ],
    }),
  );
}
function button(label: string) {
  const b = render().find(
    (n) =>
      n.type === "button" &&
      (Array.isArray(n.props.children) ? n.props.children.join("") : n.props.children) === label,
  );
  if (!b) throw new Error(`Missing button ${label}`);
  return b;
}
async function click(label: string) {
  (button(label).props.onClick as () => void)();
  await new Promise((r) => setTimeout(r, 0));
}
function ack(init: RequestInit) {
  const c = JSON.parse(String(init.body));
  return {
    productId: "prd_a",
    selection: {
      revision: c.expectedRevision + 1,
      mode: c.mode,
      buildId: c.buildId ?? null,
      updatedAt: "2026-10-12T00:00:00.000Z",
    },
  };
}
beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  h.locale = "en";
  vi.clearAllMocks();
  vi.stubGlobal("fetch", h.fetch);
  vi.stubGlobal("window", { location: { reload: h.reload } });
});
afterEach(() => vi.unstubAllGlobals());
it.each(["en", "ru"])("freezes a lost request and retries it exactly in %s", async (locale) => {
  h.locale = locale;
  const copy = getResourceReleaseControlCopy(locale);
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  await click(`${copy.choose}: 2`);
  const init = h.fetch.mock.calls[0][1] as RequestInit;
  expect(button(`${copy.choose}: 3`).props.disabled).toBe(true);
  await click(`${copy.choose}: 3`); // Even a stale handler cannot replace the frozen command.
  expect(h.fetch).toHaveBeenCalledOnce();
  h.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ack(init) });
  await click(copy.retrySame);
  expect(h.fetch.mock.calls[1][1].body).toBe(init.body);
  expect(h.refresh).toHaveBeenCalledOnce();
  expect(button(`${copy.choose}: 2`).props.disabled).toBe(true);
});
it("keeps a malformed success response unresolved until the same request is confirmed", async () => {
  h.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });
  await click("Use latest approved version");
  expect(h.refresh).not.toHaveBeenCalled();
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
  expect(button("Retry the same request").props.disabled).toBe(false);
  await click("Reload current state");
  expect(h.reload).toHaveBeenCalledOnce();
});
it.each([400, 401, 403, 404, 409])(
  "requires reloading after a definitive rejection %s",
  async (status) => {
    h.fetch.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ code: "LIBRARY_RELEASE_CONFLICT" }),
    });
    await click("Use this version: 2");
    expect(
      render().some((n) => n.type === "button" && n.props.children === "Retry the same request"),
    ).toBe(false);
    expect(h.refresh).not.toHaveBeenCalled();
    expect(button("Use this version: 3").props.disabled).toBe(true);
    await click("Reload current state");
    expect(h.reload).toHaveBeenCalledOnce();
  },
);
it.each([429, 500, 503])(
  "retains the exact command after retryable response %s",
  async (status) => {
    h.fetch.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ code: "RATE_LIMIT_EXCEEDED" }),
    });
    await click("Use this version: 2");
    const init = h.fetch.mock.calls[0][1] as RequestInit;
    h.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ack(init) });
    await click("Retry the same request");
    expect(h.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(h.refresh).toHaveBeenCalledOnce();
  },
);
it("coalesces duplicate clicks and prevents reload during an in-flight request", async () => {
  let resolve: (value: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await click("Use this version: 2");
  await click("Use this version: 2");
  expect(h.fetch).toHaveBeenCalledOnce();
  expect(button("Reload current state").props.disabled).toBe(true);
  const init = h.fetch.mock.calls[0][1] as RequestInit;
  resolve({ ok: true, status: 200, json: async () => ack(init) });
  await new Promise((r) => setTimeout(r, 0));
  expect(h.refresh).toHaveBeenCalledOnce();
});
