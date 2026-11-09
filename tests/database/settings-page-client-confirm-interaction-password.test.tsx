import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createSettingsPageClientConfirmInteractionHelpers,
  findNamed,
  mockReactHooks,
  otherSession,
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

it("confirms a password change before posting the update", async () => {
  const copy = getDictionary("en").settings;
  harness.fetch
    .mockResolvedValueOnce(response({ success: true, revokedSessionCount: 2 }))
    .mockResolvedValueOnce(response({ actorId: "usr_owner", sessions: [otherSession] }));

  const form = findNamed(render(), "SettingsPasswordForm");
  await (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
    preventDefault() {},
  });
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.changePasswordConfirmTitle,
    object: copy.changePassword,
    consequences: copy.changePasswordConfirm,
    confirmLabel: copy.updatePassword,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/auth/password",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        currentPassword: "current-pass",
        newPassword: "replacement-pass",
        expectedActorId: "usr_owner",
      }),
    }),
  );
});

it("does not change the password when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  const form = findNamed(render(), "SettingsPasswordForm");
  await (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
    preventDefault() {},
  });
  expect(harness.fetch).not.toHaveBeenCalled();
});
