import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { flattenReactTestTree } from "./flatten-react-test-tree";

type StorageMaintenanceActorHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
  actor: string;
};

type StorageCleanupControlsComponent = (props: {
  actorId: string;
  id: string;
  revision: number;
  locale: string;
}) => ReactNode;

type StorageDiscoveryControlsComponent = (props: {
  actorId: string;
  locale: string;
}) => ReactNode;

export const reply = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });

/** Shared react mock factory for storage-maintenance actor suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: StorageMaintenanceActorHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = initial;
      return [
        harness.slots[i],
        (value: unknown) => {
          harness.slots[i] = typeof value === "function" ? value(harness.slots[i]) : value;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = { current: initial };
      return harness.slots[i];
    },
    useEffect: () => {},
  });
}

export function createStorageMaintenanceActorInteractionHelpers(
  harness: StorageMaintenanceActorHarness,
  StorageCleanupControls: StorageCleanupControlsComponent,
  StorageDiscoveryControls: StorageDiscoveryControlsComponent,
) {
  function renderCleanup() {
    harness.cursor = 0;
    return flattenReactTestTree(
      StorageCleanupControls({
        actorId: harness.actor,
        id: "smo_a",
        revision: 1,
        locale: "en",
      }) as ReactNode,
    );
  }

  function renderDiscovery() {
    harness.cursor = 0;
    return flattenReactTestTree(
      StorageDiscoveryControls({ actorId: harness.actor, locale: "en" }) as ReactNode,
    );
  }

  function check() {
    const input = renderCleanup().find((n) => n.type === "input" && n.props.type === "checkbox");
    if (!input) throw Error("Missing confirmation");
    (input.props.onChange as (event: unknown) => void)({ target: { checked: true } });
  }

  function click(nodes: ReturnType<typeof renderCleanup>, label: string) {
    const button = nodes.find((n) => n.type === "button" && n.props.children === label);
    if (!button) throw Error(`Missing ${label}`);
    (button.props.onClick as () => void)();
  }

  beforeEach(() => {
    harness.slots = [];
    harness.actor = "usr_a";
    harness.fetch.mockReset();
    harness.refresh.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  return { renderCleanup, renderDiscovery, check, click };
}
