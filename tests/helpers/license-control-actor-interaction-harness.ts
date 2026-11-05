import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { flattenReactTestTree } from "./flatten-react-test-tree";

type LicenseControlActorHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
  actor: string;
  effects: (() => unknown)[];
  blur: undefined | (() => void);
  visibility: undefined | (() => void);
  owner: boolean;
  unbound: boolean;
};

const license = {
  id: "lic_a",
  status: "active",
  effectiveStatus: "active",
  updatedAt: "2026-10-10T00:00:00.000Z",
  expiresAt: "2099-01-01T00:00:00.000Z",
  canActivate: true,
  bindingReady: true,
  boundServerId: "srv_a" as string | null,
};

type LicenseControlPanelComponent = (props: {
  actorId: string;
  license: typeof license;
  moderation?: boolean;
}) => ReactNode;

/** Shared react mock factory for license-control actor suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: LicenseControlActorHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useId: () => "control",
    useState: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots))
        harness.slots[i] = typeof initial === "function" ? initial() : initial;
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
    useEffect: (effect: () => unknown) => {
      harness.effects.push(effect);
    },
  });
}

export function createLicenseControlActorInteractionHelpers(
  harness: LicenseControlActorHarness,
  LicenseControlPanel: LicenseControlPanelComponent,
) {
  function render() {
    harness.cursor = 0;
    harness.effects = [];
    return flattenReactTestTree(
      LicenseControlPanel({
        actorId: harness.actor,
        license: harness.unbound ? { ...license, boundServerId: null } : license,
        moderation: !harness.owner,
      }) as ReactNode,
    );
  }

  function prepare() {
    const text = render().find((n) => n.type === "textarea");
    if (!text) throw new Error("Missing reason");
    (text.props.onChange as (event: unknown) => void)({ target: { value: "Valid reason" } });
    const checkbox = render().find((n) => n.type === "input" && n.props.type === "checkbox");
    if (!checkbox) throw new Error("Missing confirmation");
    (checkbox.props.onChange as (event: unknown) => void)({ target: { checked: true } });
  }

  function submit() {
    const form = render().find((n) => n.type === "form");
    if (!form) throw new Error("Missing form");
    return (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  }

  beforeEach(() => {
    harness.slots = [];
    harness.actor = "usr_a";
    harness.effects = [];
    harness.blur = undefined;
    harness.visibility = undefined;
    harness.owner = false;
    harness.unbound = false;
    harness.fetch.mockReset();
    harness.refresh.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("document", {
      visibilityState: "hidden",
      addEventListener: (_: string, callback: () => void) => {
        harness.visibility = callback;
      },
      removeEventListener: () => {},
    });
    vi.stubGlobal("window", {
      addEventListener: (name: string, callback: () => void) => {
        if (name === "blur") harness.blur = callback;
      },
      removeEventListener: () => {},
      location: { reload: () => {} },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  return { render, prepare, submit };
}
