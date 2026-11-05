import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";

export type SettingsPageClientConfirmHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: Array<undefined | (() => void)>;
  effect: null | (() => undefined | (() => void));
  fetch: Mock;
};

export type Element = ReactElement<Record<string, unknown>>;

export type SettingsPageClientComponent = () => ReactNode;

export type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const preferences = {
  followsEnabled: true,
  contentEnabled: true,
  serverEnabled: true,
  commerceEnabled: true,
  systemEnabled: true,
};

export const otherSession = {
  id: "sess_other",
  expiresAt: "2026-12-01T00:00:00.000Z",
  ipAddress: "203.0.113.10",
  userAgent: "Other Browser",
  createdAt: "2026-10-01T00:00:00.000Z",
  isCurrent: false,
};

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for settings confirm suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: SettingsPageClientConfirmHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = initial;
      return [
        harness.slots[index],
        (value: unknown) => {
          harness.slots[index] =
            typeof value === "function"
              ? (value as (current: unknown) => unknown)(harness.slots[index])
              : value;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = { current: initial };
      return harness.slots[index];
    },
    useMemo: (factory: () => unknown) => factory(),
    useEffect: (effect: () => undefined | (() => void)) => {
      // Individual bootstrap tests invoke the effect explicitly.
      harness.effect = effect;
    },
  });
}

export function componentName(type: Element["type"]): string | undefined {
  if (typeof type === "string") return type;
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name;
  }
  if (typeof type === "object" && type !== null) {
    return (type as { displayName?: string }).displayName;
  }
  return undefined;
}

export function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...descendants(element.props.children as ReactNode)];
}

export function findNamed(nodes: Element[], name: string) {
  const found = nodes.find((node) => componentName(node.type) === name);
  if (!found) throw new Error(`Missing ${name}`);
  return found;
}

export function seedLoadedSettings(harness: SettingsPageClientConfirmHarness) {
  harness.slots = [
    preferences,
    { actorId: "usr_owner", sessions: [otherSession] },
    false,
    false,
    false,
    0,
    null,
    false,
    { current: false },
    { currentPassword: "current-pass", newPassword: "replacement-pass" },
    {
      actorId: "usr_owner",
      email: "member@example.com",
      verified: true,
      verifiedAt: "2026-09-01T00:00:00.000Z",
      eligible: true,
    },
    "",
    "usr_owner",
  ];
}

export function createSettingsPageClientConfirmInteractionHelpers(
  harness: SettingsPageClientConfirmHarness,
  SettingsPageClient: SettingsPageClientComponent,
  confirmAction: ConfirmActionMock,
) {
  function render() {
    harness.cursor = 0;
    return descendants(SettingsPageClient());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.cursor = 0;
    harness.cleanups = [];
    harness.effect = null;
    seedLoadedSettings(harness);
    confirmAction.mockResolvedValue(true);
    harness.fetch.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => {
    for (const cleanup of harness.cleanups) cleanup?.();
    vi.unstubAllGlobals();
  });

  return { render };
}
