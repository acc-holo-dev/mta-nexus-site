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
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../../src/components/locale-context", async () => {
  const { getDictionary } = await import("../../src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { WebPushSettings } from "../../src/components/web-push-settings";

const { render, renderEnabled, disableButton } = createWebPushSettingsConfirmInteractionHelpers(
  harness,
  WebPushSettings,
  confirmAction,
);

it("does not unsubscribe when the session changes after server deletion", async () => {
  harness.getSubscription.mockResolvedValueOnce({
    endpoint: "https://push.example/endpoint-a",
    unsubscribe: harness.unsubscribe,
    options: { applicationServerKey: null },
  });
  harness.fetch
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({ success: true }))
    .mockResolvedValueOnce(response({ sessionId: "ses_other" }));
  (disableButton(renderEnabled()).props.onClick as () => void)();
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(harness.unsubscribe).not.toHaveBeenCalled();
});

it("does not unsubscribe an endpoint the current session did not delete", async () => {
  harness.getSubscription.mockResolvedValueOnce({
    endpoint: "https://push.example/endpoint-a",
    unsubscribe: harness.unsubscribe,
    options: { applicationServerKey: null },
  });
  harness.fetch
    .mockResolvedValueOnce(response({}))
    .mockResolvedValueOnce(response({ success: true, removed: false }));
  (disableButton(renderEnabled()).props.onClick as () => void)();
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(harness.unsubscribe).not.toHaveBeenCalled();
});
