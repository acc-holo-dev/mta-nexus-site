import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createSettingsPageClientConfirmInteractionHelpers,
  findNamed,
  mockReactHooks,
  preferences,
  response,
} from "../helpers/settings-page-client-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as Array<undefined | (() => void)>,
  effect: null as null | (() => undefined | (() => void)),
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { SettingsPageClient } from "../../apps/web/src/components/settings-page-client";
import { getDictionary } from "../../apps/web/src/lib/i18n";

const { render } = createSettingsPageClientConfirmInteractionHelpers(
  harness,
  SettingsPageClient,
  confirmAction,
);

it("binds preference changes to the account whose settings were loaded", async () => {
  harness.fetch.mockResolvedValueOnce(
    response({
      success: true,
      actorId: "usr_owner",
      preferences: { ...preferences, followsEnabled: false },
    }),
  );
  const section = findNamed(render(), "SettingsNotificationPreferencesSection");
  (section.props.onPreferenceChange as (key: string, value: boolean) => void)(
    "followsEnabled",
    false,
  );
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledOnce());
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/notifications/preferences",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ expectedActorId: "usr_owner", followsEnabled: false }),
    }),
  );
  await vi.waitFor(() =>
    expect(
      findNamed(render(), "SettingsNotificationPreferencesSection").props.preferences,
    ).toMatchObject({ followsEnabled: false }),
  );
});

it("disables preference edits and offers reload when the account changed", async () => {
  harness.fetch.mockResolvedValueOnce(
    response({ code: "ACTOR_CHANGED", error: "Account changed" }, 409),
  );
  const section = findNamed(render(), "SettingsNotificationPreferencesSection");
  (section.props.onPreferenceChange as (key: string, value: boolean) => void)(
    "followsEnabled",
    false,
  );
  await vi.waitFor(() =>
    expect(
      findNamed(render(), "SettingsNotificationPreferencesSection").props.preferences,
    ).toBeNull(),
  );
  expect(findNamed(render(), "ErrorState").props.title).toBe(
    getDictionary("en").settings.preferenceAccountChanged,
  );
});
