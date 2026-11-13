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

const { renderEnabled, disableButton } = createWebPushSettingsConfirmInteractionHelpers(
  harness,
  WebPushSettings,
  confirmAction,
);

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
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({ success: true }))
    .mockResolvedValueOnce(response({}))
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
  expect(harness.fetch.mock.calls[1]?.[0]).toBe("/api/notifications/push");
  expect(harness.fetch.mock.calls[1]?.[1]).toMatchObject({
    method: "DELETE",
    body: JSON.stringify({
      endpoint: "https://push.example/endpoint-a",
      expectedActorId: "usr_1",
      expectedSessionId: "ses_1",
    }),
  });
});

it("does not disable or unsubscribe when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await (disableButton(renderEnabled()).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.unsubscribe).not.toHaveBeenCalled();
  expect(harness.getRegistration).not.toHaveBeenCalled();
});
