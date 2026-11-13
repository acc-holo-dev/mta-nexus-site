import { expect, it, vi } from "vitest";
import {
  createWebPushSettingsConfirmInteractionHelpers,
  mockReactHooks,
  response,
} from "./helpers/web-push-settings-confirm-interaction-harness";

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
vi.mock("../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../site/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { WebPushSettings } from "../site/src/components/web-push-settings";

const { render, renderEnabled, disableButton, disableButtonOrEnable } =
  createWebPushSettingsConfirmInteractionHelpers(harness, WebPushSettings, confirmAction);

it("reports an error if the browser refuses to unsubscribe", async () => {
  harness.getSubscription.mockResolvedValue({
    endpoint: "https://push.example/endpoint-a",
    unsubscribe: harness.unsubscribe,
    options: { applicationServerKey: null },
  });
  harness.fetch
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({ success: true }))
    .mockResolvedValueOnce(response({}));
  harness.unsubscribe.mockResolvedValueOnce(false);

  (disableButton(renderEnabled()).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.unsubscribe).toHaveBeenCalledOnce());
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(harness.fetch).toHaveBeenCalledTimes(3);
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
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({ success: true }))
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({ configured: true, publicKey: "AQ", subscribed: false }));
  (disableButton(renderEnabled()).props.onClick as () => void)();
  await vi.waitFor(() => expect(disableButtonOrEnable(render())).toBe(true));
  expect(render().some((node) => node.props.role === "alert")).toBe(false);
});
