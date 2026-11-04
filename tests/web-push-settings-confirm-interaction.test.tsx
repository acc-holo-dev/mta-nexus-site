import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  ids: 0,
  fetch: vi.fn(),
  unsubscribe: vi.fn(async () => true),
  getSubscription: vi.fn(),
  getRegistration: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
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
  useEffect: () => {
    // Enabled status is seeded; skip browser capability bootstrap for confirm coverage.
  },
}));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { WebPushSettings } from "../apps/web/src/components/web-push-settings";
import { getDictionary } from "../apps/web/src/lib/i18n";

type Element = ReactElement<Record<string, unknown>>;

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

function renderEnabled() {
  harness.slots = ["enabled", "vapid-public-key", false];
  harness.cursor = 0;
  harness.ids = 0;
  return descendants(WebPushSettings());
}

function disableButton(nodes: Element[]) {
  const copy = getDictionary("en").settings;
  const found = nodes.find(
    (node) => node.type === "button" && node.props.children === copy.webPushDisable,
  );
  if (!found) throw new Error("Missing disable push control");
  return found;
}

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
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
    PushManager: function PushManager() {},
    Notification: notification,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("confirms before disabling browser push and unsubscribing", async () => {
  const copy = getDictionary("en").settings;
  harness.getSubscription
    .mockResolvedValueOnce({
      endpoint: "https://push.example/endpoint-a",
      unsubscribe: harness.unsubscribe,
      options: { applicationServerKey: null },
    })
    .mockResolvedValue(null);
  harness.fetch
    .mockResolvedValueOnce(response({ success: true }))
    .mockResolvedValueOnce(
      response({ configured: true, publicKey: "vapid-public-key", subscribed: false }),
    );

  await (disableButton(renderEnabled()).props.onClick as () => Promise<void>)();

  await vi.waitFor(() => expect(harness.unsubscribe).toHaveBeenCalledOnce());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.webPushDisableConfirmTitle,
    object: copy.webPush,
    consequences: copy.webPushDisableConfirm,
    confirmLabel: copy.webPushDisable,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch.mock.calls[0]?.[0]).toBe("/api/notifications/push");
  expect(harness.fetch.mock.calls[0]?.[1]).toMatchObject({
    method: "DELETE",
    body: JSON.stringify({ endpoint: "https://push.example/endpoint-a" }),
  });
});

it("does not disable or unsubscribe when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await (disableButton(renderEnabled()).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.unsubscribe).not.toHaveBeenCalled();
  expect(harness.getRegistration).not.toHaveBeenCalled();
});
