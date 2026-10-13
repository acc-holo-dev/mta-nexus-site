import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanup: undefined as (() => void) | undefined,
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
  useEffect: (effect: () => () => void) => {
    const i = h.cursor++;
    if (!(i in h.slots)) {
      h.slots[i] = true;
      h.cleanup = effect();
    }
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
import { LibraryReleaseComparisonSelection } from "../apps/web/src/components/library-release-comparison-selection";
import { libraryReleaseComparisonCopy } from "../apps/web/src/lib/library-release-comparison-i18n";
import { getResourceReleaseControlCopy } from "../apps/web/src/lib/resource-release-control-i18n";
type Element = ReactElement<Record<string, unknown>>;
function nodes(n: ReactNode): Element[] {
  if (Array.isArray(n)) return n.flatMap(nodes);
  if (!n || typeof n !== "object" || !("props" in n)) return [];
  const e = n as Element;
  if (typeof e.type === "function")
    return [e, ...nodes((e.type as (p: unknown) => ReactNode)(e.props))];
  return [e, ...nodes(e.props.children as ReactNode)];
}
let target = { id: "bld_b", version: "2", sha256Hash: "b".repeat(64), fileSizeBytes: 100 };
let selection = {
  revision: 3,
  mode: "latest" as "latest" | "fixed",
  buildId: null as string | null,
};
function render() {
  h.cursor = 0;
  return nodes(
    LibraryReleaseComparisonSelection({ productId: "prd_a", locale: h.locale, selection, target }),
  );
}
function button(label: string) {
  const b = render().find((n) => n.type === "button" && n.props.children === label);
  if (!b) throw new Error(`Missing button ${label}`);
  return b;
}
async function click(label: string) {
  (button(label).props.onClick as () => void)();
  await new Promise((r) => setTimeout(r, 0));
}
function confirm() {
  const input = render().find((n) => n.type === "input" && n.props.type === "checkbox");
  if (!input) throw new Error("Missing confirmation");
  (input.props.onChange as (e: unknown) => void)({ target: { checked: true } });
}
beforeEach(() => {
  h.slots = [];
  h.cleanup = undefined;
  h.cursor = 0;
  h.locale = "en";
  target = { id: "bld_b", version: "2", sha256Hash: "b".repeat(64), fileSizeBytes: 100 };
  selection = { revision: 3, mode: "latest", buildId: null };
  vi.clearAllMocks();
  vi.stubGlobal("fetch", h.fetch);
  vi.stubGlobal("window", { location: { reload: h.reload } });
});
afterEach(() => vi.unstubAllGlobals());
it.each(["en", "ru"])(
  "requires explicit confirmation and freezes the exact reviewed archive in %s",
  async (locale) => {
    h.locale = locale;
    const copy = libraryReleaseComparisonCopy(locale);
    const control = getResourceReleaseControlCopy(locale);
    expect(button(copy.chooseCompared).props.disabled).toBe(true);
    await click(copy.chooseCompared);
    expect(h.fetch).not.toHaveBeenCalled();
    confirm();
    h.fetch.mockRejectedValueOnce(new Error("lost"));
    await click(copy.chooseCompared);
    const init = h.fetch.mock.calls[0][1] as RequestInit;
    const command = JSON.parse(String(init.body));
    expect(command).toEqual({
      mode: "fixed",
      buildId: "bld_b",
      expectedRevision: 3,
      reviewedArtifact: { sha256Hash: target.sha256Hash, fileSizeBytes: 100 },
    });
    expect(render().find((n) => n.type === "input")?.props.disabled).toBe(true);
    h.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        productId: "prd_a",
        selection: {
          revision: 4,
          mode: "fixed",
          buildId: "bld_b",
          updatedAt: "2026-10-12T00:00:00.000Z",
        },
      }),
    });
    await click(control.retrySame);
    expect(h.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(h.refresh).toHaveBeenCalledOnce();
  },
);
it("requires a new comparison after archive or preference conflict", async () => {
  confirm();
  h.fetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({ code: "LIBRARY_RELEASE_REVIEW_CHANGED" }),
  });
  await click(libraryReleaseComparisonCopy("en").chooseCompared);
  expect(
    render().some(
      (n) =>
        n.props.role === "alert" &&
        n.props.children ===
          "The reviewed archive changed. Reload the comparison before choosing it.",
    ),
  ).toBe(true);
  expect(
    render().some((n) => n.type === "button" && n.props.children === "Retry the same request"),
  ).toBe(false);
  await click("Reload current state");
  expect(h.reload).toHaveBeenCalledOnce();
});
it("does not send a command for an already fixed target", () => {
  selection = { revision: 4, mode: "fixed", buildId: target.id };
  expect(render().some((n) => n.type === "input")).toBe(false);
  expect(render().some((n) => n.props.role === "status")).toBe(true);
  expect(h.fetch).not.toHaveBeenCalled();
});
it("requires renewed acknowledgement when comparison metadata changes and ignores the old handler", async () => {
  confirm();
  const stale = button(libraryReleaseComparisonCopy("en").chooseCompared).props
    .onClick as () => void;
  target = { ...target, sha256Hash: "c".repeat(64), fileSizeBytes: 101 };
  selection = { ...selection, revision: 8 };
  expect(button(libraryReleaseComparisonCopy("en").chooseCompared).props.disabled).toBe(true);
  stale();
  expect(h.fetch).not.toHaveBeenCalled();
  confirm();
  h.fetch.mockRejectedValueOnce(Error("unknown response"));
  await click(libraryReleaseComparisonCopy("en").chooseCompared);
  expect(JSON.parse(String(h.fetch.mock.calls[0]?.[1].body))).toMatchObject({
    expectedRevision: 8,
    reviewedArtifact: { sha256Hash: "c".repeat(64), fileSizeBytes: 101 },
  });
});
it("captures reviewed values instead of following later mutation of caller-owned objects", async () => {
  confirm();
  const apply = button(libraryReleaseComparisonCopy("en").chooseCompared).props
    .onClick as () => void;
  target.sha256Hash = "c".repeat(64);
  selection.revision = 8;
  h.fetch.mockRejectedValueOnce(Error("unknown response"));
  apply();
  await new Promise((r) => setTimeout(r, 0));
  expect(JSON.parse(String(h.fetch.mock.calls[0]?.[1].body))).toMatchObject({
    expectedRevision: 3,
    reviewedArtifact: { sha256Hash: "b".repeat(64), fileSizeBytes: 100 },
  });
});
