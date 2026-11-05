import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { getDictionary } from "../../apps/web/src/lib/i18n";

export type WebPushSettingsConfirmHarness = {
  slots: unknown[];
  cursor: number;
  ids: number;
  fetch: Mock;
  unsubscribe: Mock;
  getSubscription: Mock;
  getRegistration: Mock;
  effect: null | (() => undefined | (() => void));
  expectedIdentity: { actorId: string; sessionId: string } | null;
};

export type Element = ReactElement<Record<string, unknown>>;

export type WebPushSettingsComponent = (props: {
  expectedIdentity: WebPushSettingsConfirmHarness["expectedIdentity"];
}) => ReactNode;

export type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

/** Browser PushManager presence stub — module-scoped to avoid Biome component-in-hook lint. */
function mockPushManager() {}

export const response = (body: Record<string, unknown>, status = 200) =>
  new Response(
    JSON.stringify({
      actorId: "usr_1",
      sessionId: "ses_1",
      configured: true,
      publicKey: "AQ",
      subscribed: false,
      removed: true,
      ...body,
    }),
    { status, headers: { "content-type": "application/json" } },
  );

/** Shared react mock factory for web-push confirm suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: WebPushSettingsConfirmHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useId: () => `push-${harness.ids++}`,
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
    useEffect: (effect: () => undefined | (() => void)) => {
      harness.effect = effect;
    },
  });
}

function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  const type = element.type as { displayName?: string } | string;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [
      { ...element, type: "button" } as Element,
      ...descendants(element.props.children as ReactNode),
    ];
  }
  return [element, ...descendants(element.props.children as ReactNode)];
}

export function createWebPushSettingsConfirmInteractionHelpers(
  harness: WebPushSettingsConfirmHarness,
  WebPushSettings: WebPushSettingsComponent,
  confirmAction: ConfirmActionMock,
) {
  function render() {
    harness.cursor = 0;
    harness.effect = null;
    harness.ids = 0;
    return descendants(WebPushSettings({ expectedIdentity: harness.expectedIdentity }));
  }

  function renderEnabled() {
    harness.slots = [
      "enabled",
      "vapid-public-key",
      false,
      0,
      { actorId: "usr_1", sessionId: "ses_1" },
    ];
    return render();
  }

  function disableButton(nodes: Element[]) {
    const copy = getDictionary("en").settings;
    const found = nodes.find(
      (node) => node.type === "button" && node.props.children === copy.webPushDisable,
    );
    if (!found) throw new Error("Missing disable push control");
    return found;
  }

  function disableButtonOrEnable(nodes: Element[]) {
    return nodes.some(
      (node) =>
        node.type === "button" &&
        node.props.children === getDictionary("en").settings.webPushEnable,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.expectedIdentity = { actorId: "usr_1", sessionId: "ses_1" };
    confirmAction.mockResolvedValue(true);
    harness.fetch.mockReset();
    harness.unsubscribe.mockReset().mockResolvedValue(true);
    harness.getSubscription.mockReset();
    harness.getRegistration.mockReset().mockResolvedValue({
      pushManager: { getSubscription: harness.getSubscription },
    });
    vi.stubGlobal("fetch", harness.fetch);
    const notification = { permission: "granted" as NotificationPermission };
    vi.stubGlobal("Notification", notification);
    vi.stubGlobal("navigator", {
      serviceWorker: { getRegistration: harness.getRegistration },
    });
    vi.stubGlobal("window", {
      PushManager: mockPushManager,
      Notification: notification,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return {
    render,
    renderEnabled,
    disableButton,
    disableButtonOrEnable,
  };
}
