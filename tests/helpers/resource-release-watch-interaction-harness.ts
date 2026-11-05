import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { resourceReleaseWatchesCopy } from "../../apps/web/src/lib/resource-release-watches-i18n";

type ResourceReleaseWatchInteractionHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
  reload: Mock;
  locale: string;
  cleanup: (() => void) | null;
};

type Element = ReactElement<Record<string, unknown>>;

type ResourceReleaseWatchControlComponent = (props: {
  watch: {
    productId: string;
    enabled: boolean;
    revision: number;
    updatedAt: Date;
  };
  available: boolean;
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

/** Shared react mock factory for resource-release-watch interaction suites. */
export function mockReactHooks(harness: ResourceReleaseWatchInteractionHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useEffect: (effect: () => () => void) => {
      harness.cleanup ??= effect();
    },
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
    useRef: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = { current: initial };
      return harness.slots[i];
    },
  });
}

export function createResourceReleaseWatchInteractionHelpers(
  harness: ResourceReleaseWatchInteractionHarness,
  ResourceReleaseWatchControl: ResourceReleaseWatchControlComponent,
  confirmAction: ConfirmActionMock,
) {
  let watch = {
    productId: "prd_a",
    enabled: false,
    revision: 2,
    updatedAt: new Date("2026-10-12T00:00:00.000Z"),
  };
  let available = true;

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

  function render() {
    harness.cursor = 0;
    return nodes(ResourceReleaseWatchControl({ watch, available }));
  }

  function button(label: string) {
    const b = render().find((n) => n.type === "button" && n.props.children === label);
    if (!b) throw new Error(`Missing ${label}`);
    return b;
  }

  async function click(label: string) {
    await (button(label).props.onClick as () => Promise<void>)();
  }

  const ack = {
    productId: "prd_a",
    enabled: true,
    revision: 3,
    updatedAt: "2026-10-12T00:00:00.001Z",
  };

  function reset() {
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanup = null;
    harness.locale = "en";
    available = true;
    watch = {
      productId: "prd_a",
      enabled: false,
      revision: 2,
      updatedAt: new Date("2026-10-12T00:00:00.000Z"),
    };
    vi.clearAllMocks();
    confirmAction.mockResolvedValue(true);
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("window", { location: { reload: harness.reload } });
  }

  beforeEach(reset);
  afterEach(() => vi.unstubAllGlobals());

  return {
    ack,
    button,
    click,
    render,
    copy: (locale: "en" | "ru" = "en") => resourceReleaseWatchesCopy(locale),
    setWatch: (next: Partial<typeof watch>) => {
      watch = { ...watch, ...next };
    },
    setAvailable: (next: boolean) => {
      available = next;
    },
  };
}
