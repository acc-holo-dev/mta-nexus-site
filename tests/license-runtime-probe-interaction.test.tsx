import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getLicenseControlCopy } from "../apps/web/src/lib/license-control-i18n";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  cleanup: null as (() => void) | null,
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: () => {
    // Keep seeded loaded state for Button host expansion.
  },
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

import { LicenseRuntimeProbe } from "../apps/web/src/components/license-runtime-probe";

type Element = ReactElement<Record<string, unknown>>;
function nodes(n: ReactNode): Element[] {
  if (Array.isArray(n)) return n.flatMap(nodes);
  if (!n || typeof n !== "object" || !("props" in n)) return [];
  const e = n as Element;
  const type = e.type as { displayName?: string } | string;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [{ ...e, type: "button" } as Element, ...nodes(e.props.children as ReactNode)];
  }
  return [e, ...nodes(e.props.children as ReactNode)];
}

const token = `nxlt_${"a".repeat(43)}`;

function seedLoaded(page = 1, totalPages = 2) {
  // context, page, selected, loading, busy, error, command, confirmed
  h.slots = [
    {
      page,
      totalPages,
      items: [{ id: "bld_a", version: "1.0.0", sha256Hash: "b".repeat(64) }],
    },
    page,
    "bld_a",
    false,
    false,
    "",
    null,
    null,
  ];
}

function render() {
  h.cursor = 0;
  return nodes(
    LicenseRuntimeProbe({
      licenseId: "lic_a",
      token,
      locale: "en",
    }),
  );
}

function button(label: string) {
  const found = render().find((n) => n.type === "button" && n.props.children === label);
  if (!found) throw new Error(`Missing ${label}`);
  return found;
}

beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  h.cleanup = null;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it("exposes probe and pager hosts through shared Button chrome", () => {
  seedLoaded(1, 2);
  const copy = getLicenseControlCopy("en");
  const probe = button(copy.probe);
  expect(probe.props.variant).toBe("ghost");
  expect(probe.props.className).toContain("underline");
  expect(button(copy.previous).props.disabled).toBe(true);
  expect(button(copy.next).props.disabled).toBe(false);
  expect(button(copy.next).type).toBe("button");
});
