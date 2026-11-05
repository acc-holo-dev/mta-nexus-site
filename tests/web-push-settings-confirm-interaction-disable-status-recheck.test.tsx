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
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { WebPushSettings } from "../apps/web/src/components/web-push-settings";
import { getDictionary } from "../apps/web/src/lib/i18n";

const { render, disableButtonOrEnable } = createWebPushSettingsConfirmInteractionHelpers(
  harness,
  WebPushSettings,
  confirmAction,
);

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
