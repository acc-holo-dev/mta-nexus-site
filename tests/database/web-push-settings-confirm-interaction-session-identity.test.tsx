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

const { render, renderEnabled, disableButton } = createWebPushSettingsConfirmInteractionHelpers(
  harness,
  WebPushSettings,
  confirmAction,
);

it.each([
  ["different account", { actorId: "usr_other", sessionId: "ses_1" }],
  ["different session", { actorId: "usr_1", sessionId: "ses_other" }],
])("does not unsubscribe after a %s switch before disable", async (_label, nextIdentity) => {
  harness.fetch.mockResolvedValueOnce(response(nextIdentity));
  (disableButton(renderEnabled()).props.onClick as () => void)();
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(harness.unsubscribe).not.toHaveBeenCalled();
  expect(harness.fetch).toHaveBeenCalledTimes(1);
});

it("blocks a nested Web Push state belonging to a different settings account or session", async () => {
  harness.slots = ["loading", null, false, 0];
  harness.getSubscription.mockResolvedValue(null);
  harness.fetch.mockResolvedValueOnce(response({ actorId: "usr_other" }));
  render();
  harness.effect?.();
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(
    render().some(
      (node) =>
        node.type === "button" &&
        node.props.children === getDictionary("en").settings.webPushEnable,
    ),
  ).toBe(false);
  expect(harness.unsubscribe).not.toHaveBeenCalled();
});

it("immediately disables an old push snapshot when parent session changes", () => {
  renderEnabled();
  harness.expectedIdentity = { actorId: "usr_1", sessionId: "ses_other" };
  expect(
    render().some(
      (node) =>
        node.type === "button" &&
        node.props.children === getDictionary("en").settings.webPushDisable,
    ),
  ).toBe(false);
  expect(render().some((node) => node.props.role === "alert")).toBe(true);
});
