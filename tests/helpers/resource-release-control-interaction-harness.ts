import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import type { Locale } from "../../apps/web/src/lib/i18n";

type ResourceReleaseControlHarness = {
  slots: unknown[];
  cursor: number;
  cleanup: (() => void) | undefined;
  fetch: Mock;
  refresh: Mock;
  reload: Mock;
  locale: Locale;
  productId: string;
  actorId: string;
  revision: number;
  artifactValid: boolean;
  uiUpdates: number;
};

type Element = ReactElement<Record<string, unknown>>;

type LibraryReleaseSelectionControlsComponent = (props: {
  productId: string;
  actorId: string;
  revision: number;
  mode: "fixed";
  selectedBuildId: string;
  versions: {
    id: string;
    version: string;
    sha256Hash: string;
    fileSizeBytes: number;
  }[];
}) => ReactNode;

/** Shared react mock factory for release-control interaction suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ResourceReleaseControlHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = initial;
      return [
        harness.slots[i],
        (v: unknown) => {
          harness.uiUpdates++;
          harness.slots[i] =
            typeof v === "function" ? (v as (p: unknown) => unknown)(harness.slots[i]) : v;
        },
      ];
    },
    useEffect: (effect: () => () => void) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) {
        harness.slots[i] = true;
        harness.cleanup = effect();
      }
    },
    useRef: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = { current: initial };
      return harness.slots[i];
    },
  });
}

function nodes(n: ReactNode): Element[] {
  if (Array.isArray(n)) return n.flatMap(nodes);
  if (!n || typeof n !== "object" || !("props" in n)) return [];
  const e = n as Element;
  const type = e.type as { displayName?: string; render?: (props: unknown) => ReactNode } | string;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [{ ...e, type: "button" } as Element, ...nodes(e.props.children as ReactNode)];
  }
  if (typeof e.type === "function")
    return [e, ...nodes((e.type as (props: unknown) => ReactNode)(e.props))];
  return [e, ...nodes(e.props.children as ReactNode)];
}

export function ack(init: RequestInit) {
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

export function createResourceReleaseControlInteractionHelpers(
  harness: ResourceReleaseControlHarness,
  LibraryReleaseSelectionControls: LibraryReleaseSelectionControlsComponent,
) {
  function render() {
    harness.cursor = 0;
    return nodes(
      LibraryReleaseSelectionControls({
        productId: harness.productId,
        actorId: harness.actorId,
        revision: harness.revision,
        mode: "fixed",
        selectedBuildId: "bld_old",
        versions: [
          {
            id: "bld_a",
            version: "2",
            sha256Hash: harness.artifactValid ? "a".repeat(64) : "",
            fileSizeBytes: 100,
          },
          { id: "bld_b", version: "3", sha256Hash: "b".repeat(64), fileSizeBytes: 200 },
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

  beforeEach(() => {
    harness.slots = [];
    harness.cleanup = undefined;
    harness.cursor = 0;
    harness.locale = "en";
    harness.productId = "prd_a";
    harness.actorId = "usr_a";
    harness.revision = 3;
    harness.artifactValid = true;
    harness.uiUpdates = 0;
    vi.clearAllMocks();
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("window", { location: { reload: harness.reload } });
  });

  afterEach(() => vi.unstubAllGlobals());

  return { render, button, click };
}
