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
vi.mock("../../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { WebPushSettings } from "../../apps/web/src/components/web-push-settings";
import { getDictionary } from "../../apps/web/src/lib/i18n";

const { render, renderEnabled, disableButton, disableButtonOrEnable } =
  createWebPushSettingsConfirmInteractionHelpers(harness, WebPushSettings, confirmAction);

it("explains recovery when DELETE response is lost after the server removed the endpoint", async () => {
  harness.getSubscription.mockResolvedValue({
    endpoint: "https://push.example/endpoint-a",
    unsubscribe: harness.unsubscribe,
    options: { applicationServerKey: new Uint8Array([1]).buffer },
  });
  harness.fetch
    .mockResolvedValueOnce(response({}))
    .mockRejectedValueOnce(new Error("response lost"))
    .mockResolvedValueOnce(response({ publicKey: "AQ", subscribed: false }));
  (disableButton(renderEnabled()).props.onClick as () => void)();
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  const retry = render().find(
    (node) => node.type === "button" && node.props.children === getDictionary("en").settings.retry,
  );
  if (!retry) throw new Error("Missing retry");
  (retry.props.onClick as () => void)();
  render();
  harness.effect?.();
  await vi.waitFor(() => expect(disableButtonOrEnable(render())).toBe(true));
  expect(
    render().some(
      (node) => node.props.children === getDictionary("en").settings.webPushCleanupHint,
    ),
  ).toBe(true);
  expect(harness.unsubscribe).not.toHaveBeenCalled();
});

it("can re-register an orphaned local subscription and then disable it", async () => {
  let registered = false;
  let local: {
    endpoint: string;
    options: { applicationServerKey: ArrayBuffer };
    toJSON: () => object;
    unsubscribe: () => Promise<boolean>;
  } | null = null;
  const endpoint = "https://push.example/endpoint-a";
  local = {
    endpoint,
    options: { applicationServerKey: new Uint8Array([1]).buffer },
    toJSON: () => ({ endpoint, keys: { p256dh: "public", auth: "secret" } }),
    unsubscribe: vi.fn(async () => {
      local = null;
      return true;
    }),
  };
  const unsubscribe = local.unsubscribe;
  const manager = { getSubscription: vi.fn(async () => local) };
  vi.stubGlobal("Notification", {
    permission: "granted",
    requestPermission: vi.fn(async () => "granted"),
  });
  vi.stubGlobal("navigator", {
    serviceWorker: {
      register: vi.fn(async () => ({ pushManager: manager })),
      getRegistration: vi.fn(async () => ({ pushManager: manager })),
    },
  });
  harness.fetch.mockImplementation(async (_url: string, init: RequestInit) => {
    if (init.method === "POST") {
      registered = true;
      return response({ success: true, subscribed: true });
    }
    if (init.method === "DELETE") {
      registered = false;
      return response({ success: true, removed: true });
    }
    return response({ publicKey: "AQ", subscribed: registered });
  });
  harness.slots = ["disabled", "AQ", false, 0, { actorId: "usr_1", sessionId: "ses_1" }, true];
  const enable = render().find(
    (node) =>
      node.type === "button" && node.props.children === getDictionary("en").settings.webPushEnable,
  );
  if (!enable) throw new Error("Missing enable control");
  (enable.props.onClick as () => void)();
  await vi.waitFor(() => expect(disableButton(render())).toBeDefined());
  (disableButton(render()).props.onClick as () => void)();
  await vi.waitFor(() => expect(disableButtonOrEnable(render())).toBe(true));
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(registered).toBe(false);
});
