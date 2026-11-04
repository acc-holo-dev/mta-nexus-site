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
  effect: null as null | (() => undefined | (() => void)),
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
  useEffect: (effect: () => undefined | (() => void)) => {
    harness.effect = effect;
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
  return render();
}

function render() {
  harness.cursor = 0;
  harness.effect = null;
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

/** Browser PushManager presence stub — module-scoped to avoid Biome component-in-hook lint. */
function mockPushManager() {}

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
    PushManager: mockPushManager,
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

it("reports an error if the browser refuses to unsubscribe", async () => {
  harness.getSubscription.mockResolvedValue({
    endpoint: "https://push.example/endpoint-a",
    unsubscribe: harness.unsubscribe,
    options: { applicationServerKey: null },
  });
  harness.fetch.mockResolvedValueOnce(response({ success: true }));
  harness.unsubscribe.mockResolvedValueOnce(false);

  (disableButton(renderEnabled()).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.unsubscribe).toHaveBeenCalledOnce());
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(harness.fetch).toHaveBeenCalledTimes(1);
});

it("accepts a false unsubscribe result when the subscription is already gone", async () => {
  harness.getSubscription
    .mockResolvedValueOnce({
      endpoint: "https://push.example/endpoint-a",
      unsubscribe: harness.unsubscribe,
      options: { applicationServerKey: null },
    })
    .mockResolvedValue(null);
  harness.unsubscribe.mockResolvedValueOnce(false);
  harness.fetch
    .mockResolvedValueOnce(response({ success: true }))
    .mockResolvedValueOnce(response({ configured: true, publicKey: "AQ", subscribed: false }));
  (disableButton(renderEnabled()).props.onClick as () => void)();
  await vi.waitFor(() => expect(disableButtonOrEnable(render())).toBe(true));
  expect(render().some((node) => node.props.role === "alert")).toBe(false);
});

it("rechecks status after an error without changing the subscription", async () => {
  harness.slots = ["error", null, false, 0];
  const nodes = render();
  const retry = nodes.find(
    (node) => node.type === "button" && node.props.children === getDictionary("en").settings.retry,
  );
  if (!retry) throw new Error("Missing push retry control");
  harness.getSubscription.mockResolvedValue(null);
  harness.fetch.mockResolvedValue(
    response({ configured: true, publicKey: "vapid-public-key", subscribed: false }),
  );
  (retry.props.onClick as () => void)();
  expect(
    render().some((node) => node.props.children === getDictionary("en").settings.webPushLoading),
  ).toBe(true);
  harness.effect?.();
  await vi.waitFor(() => expect(disableButtonOrEnable(render())).toBe(true));
  expect(harness.fetch.mock.calls[0]?.[1]?.method).toBeUndefined();
  expect(harness.unsubscribe).not.toHaveBeenCalled();
});

function disableButtonOrEnable(nodes: Element[]) {
  return nodes.some(
    (node) =>
      node.type === "button" && node.props.children === getDictionary("en").settings.webPushEnable,
  );
}

it("checks a rotated key without deleting either subscription", async () => {
  harness.slots = ["loading", null, false, 0];
  harness.getSubscription.mockResolvedValue({
    endpoint: "https://push.example/endpoint-a",
    unsubscribe: harness.unsubscribe,
    options: { applicationServerKey: new Uint8Array([2]).buffer },
  });
  harness.fetch.mockResolvedValue(
    response({ configured: true, publicKey: "AQ", subscribed: true }),
  );
  render();
  harness.effect?.();
  await vi.waitFor(() => expect(disableButtonOrEnable(render())).toBe(true));
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(harness.fetch.mock.calls[0]?.[1]?.method).toBeUndefined();
  expect(harness.unsubscribe).not.toHaveBeenCalled();
});

it("does not remove the browser subscription when rotation cleanup fails on the server", async () => {
  const subscribe = vi.fn();
  const manager = {
    getSubscription: vi.fn().mockResolvedValue({
      endpoint: "https://push.example/endpoint-a",
      unsubscribe: harness.unsubscribe,
      options: { applicationServerKey: new Uint8Array([2]).buffer },
    }),
    subscribe,
  };
  vi.stubGlobal("Notification", { requestPermission: vi.fn().mockResolvedValue("granted") });
  vi.stubGlobal("navigator", {
    serviceWorker: { register: vi.fn().mockResolvedValue({ pushManager: manager }) },
  });
  harness.fetch.mockResolvedValue(response({ error: "unavailable" }, 503));
  harness.slots = ["disabled", "AQ", false, 0];
  const enable = render().find(
    (node) =>
      node.type === "button" && node.props.children === getDictionary("en").settings.webPushEnable,
  );
  if (!enable) throw new Error("Missing enable control");
  (enable.props.onClick as () => void)();
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(harness.unsubscribe).not.toHaveBeenCalled();
  expect(subscribe).not.toHaveBeenCalled();
});
