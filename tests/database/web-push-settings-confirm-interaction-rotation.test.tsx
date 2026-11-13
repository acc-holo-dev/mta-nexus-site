import { expect, it, vi } from "vitest";
import {
  createWebPushSettingsConfirmInteractionHelpers,
  mockReactHooks,
  response,
} from "../helpers/web-push-settings-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  ids: 0,
  fetch: vi.fn(),
  unsubscribe: vi.fn(async () => true),
  getSubscription: vi.fn(),
  getRegistration: vi.fn(),
  effect: null as null | (() => undefined | (() => void)),
  expectedIdentity: { actorId: "usr_1", sessionId: "ses_1" } as {
    actorId: string;
    sessionId: string;
  } | null,
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../site/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { WebPushSettings } from "../../site/src/components/web-push-settings";
import { getDictionary } from "../../site/src/lib/i18n";

const { render, disableButtonOrEnable } = createWebPushSettingsConfirmInteractionHelpers(
  harness,
  WebPushSettings,
  confirmAction,
);

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
  harness.fetch
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({ error: "unavailable" }, 503));
  harness.slots = ["disabled", "AQ", false, 0, { actorId: "usr_1", sessionId: "ses_1" }];
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
