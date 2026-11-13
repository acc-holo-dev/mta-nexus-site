import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import type { Locale } from "../../site/src/lib/i18n";

type LibraryReleaseComparisonInteractionHarness = {
  slots: unknown[];
  cursor: number;
  cleanup: (() => void) | undefined;
  fetch: Mock;
  refresh: Mock;
  reload: Mock;
  locale: Locale;
};

type Element = ReactElement<Record<string, unknown>>;

type Target = {
  id: string;
  version: string;
  sha256Hash: string;
  fileSizeBytes: number;
};

type Selection = {
  revision: number;
  mode: "latest" | "fixed";
  buildId: string | null;
};

type LibraryReleaseComparisonSelectionComponent = (props: {
  productId: string;
  actorId: string;
  locale: Locale;
  selection: Selection;
  target: Target;
}) => ReactNode;

/** Shared react mock factory for library-release-comparison interaction suites. */
export function mockReactHooks(harness: LibraryReleaseComparisonInteractionHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = initial;
      return [
        harness.slots[i],
        (v: unknown) => {
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
  const type = e.type as { displayName?: string } | string | ((p: unknown) => ReactNode);
  if (typeof type === "object" && type && "displayName" in type && type.displayName === "Button") {
    return [{ ...e, type: "button" } as Element, ...nodes(e.props.children as ReactNode)];
  }
  if (typeof e.type === "function")
    return [e, ...nodes((e.type as (p: unknown) => ReactNode)(e.props))];
  return [e, ...nodes(e.props.children as ReactNode)];
}

export function createLibraryReleaseComparisonInteractionHelpers(
  harness: LibraryReleaseComparisonInteractionHarness,
  LibraryReleaseComparisonSelection: LibraryReleaseComparisonSelectionComponent,
) {
  let target: Target = {
    id: "bld_b",
    version: "2",
    sha256Hash: "b".repeat(64),
    fileSizeBytes: 100,
  };
  let selection: Selection = {
    revision: 3,
    mode: "latest",
    buildId: null,
  };

  function render() {
    harness.cursor = 0;
    return nodes(
      LibraryReleaseComparisonSelection({
        productId: "prd_a",
        actorId: "usr_a",
        locale: harness.locale,
        selection,
        target,
      }),
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

  function confirmation() {
    const input = render().find((n) => n.type === "input" && n.props.type === "checkbox");
    if (!input) throw new Error("Missing confirmation");
    return input;
  }

  function setConfirmation(checked: boolean) {
    (confirmation().props.onChange as (e: unknown) => void)({ target: { checked } });
  }

  function confirm() {
    setConfirmation(true);
  }

  beforeEach(() => {
    harness.slots = [];
    harness.cleanup = undefined;
    harness.cursor = 0;
    harness.locale = "en";
    target = { id: "bld_b", version: "2", sha256Hash: "b".repeat(64), fileSizeBytes: 100 };
    selection = { revision: 3, mode: "latest", buildId: null };
    vi.clearAllMocks();
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("window", { location: { reload: harness.reload } });
  });

  afterEach(() => vi.unstubAllGlobals());

  return {
    button,
    click,
    confirm,
    confirmation,
    render,
    setConfirmation,
    getTarget: () => target,
    setTarget: (next: Target | ((prev: Target) => Target)) => {
      target = typeof next === "function" ? next(target) : next;
    },
    getSelection: () => selection,
    setSelection: (next: Selection | ((prev: Selection) => Selection)) => {
      selection = typeof next === "function" ? next(selection) : next;
    },
    mutateTarget: (patch: Partial<Target>) => {
      Object.assign(target, patch);
    },
    mutateSelection: (patch: Partial<Selection>) => {
      Object.assign(selection, patch);
    },
  };
}
