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
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../../src/components/locale-context", async () => {
  const { getDictionary } = await import("../../src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { SettingsPageClient } from "../../src/components/settings-page-client";
import { getDictionary } from "../../src/lib/i18n";

const { render } = createSettingsPageClientConfirmInteractionHelpers(
  harness,
  SettingsPageClient,
  confirmAction,
);

it("confirms ending another session before DELETE", async () => {
  const copy = getDictionary("en").settings;
  harness.fetch
    .mockResolvedValueOnce(response({ success: true, scope: "single", sessionId: otherSession.id }))
    .mockResolvedValueOnce(response({ actorId: "usr_owner", sessions: [] }));

  const sessions = findNamed(render(), "SettingsActiveSessions");
  await (sessions.props.onRevokeSession as (sessionId: string, label: string) => Promise<void>)(
    otherSession.id,
    otherSession.userAgent,
  );
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.endSessionConfirmTitle,
    object: otherSession.userAgent,
    consequences: copy.endSessionConfirm,
    confirmLabel: copy.endSession,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/auth/sessions",
    expect.objectContaining({
      method: "DELETE",
      body: JSON.stringify({ sessionId: otherSession.id, expectedActorId: "usr_owner" }),
    }),
  );
});

it("skips session revocation when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  const sessions = findNamed(render(), "SettingsActiveSessions");
  await (sessions.props.onRevokeSession as (sessionId: string, label: string) => Promise<void>)(
    otherSession.id,
    otherSession.userAgent,
  );
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("confirms ending all other sessions before DELETE", async () => {
  const copy = getDictionary("en").settings;
  harness.fetch
    .mockResolvedValueOnce(response({ success: true, scope: "others", revokedCount: 1 }))
    .mockResolvedValueOnce(response({ actorId: "usr_owner", sessions: [] }));

  const sessions = findNamed(render(), "SettingsActiveSessions");
  await (sessions.props.onRevokeOthers as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.endOtherSessionsConfirmTitle,
    object: copy.endOtherSessions,
    consequences: copy.endOtherSessionsConfirm,
    confirmLabel: copy.endOtherSessions,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/auth/sessions",
    expect.objectContaining({
      method: "DELETE",
      body: JSON.stringify({ allOther: true, expectedActorId: "usr_owner" }),
    }),
  );
});
