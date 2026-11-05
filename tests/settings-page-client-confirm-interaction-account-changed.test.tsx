import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  componentName,
  createSettingsPageClientConfirmInteractionHelpers,
  findNamed,
  mockReactHooks,
  otherSession,
  response,
} from "./helpers/settings-page-client-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as Array<undefined | (() => void)>,
  effect: null as null | (() => undefined | (() => void)),
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { SettingsPageClient } from "../apps/web/src/components/settings-page-client";
import { getDictionary } from "../apps/web/src/lib/i18n";

const { render } = createSettingsPageClientConfirmInteractionHelpers(
  harness,
  SettingsPageClient,
  confirmAction,
);

it.each(["password", "single session", "other sessions"] as const)(
  "blocks stale settings after %s succeeds and refresh finds another account",
  async (operation) => {
    harness.slots[11] = "sensitive recovery password";
    const success =
      operation === "password"
        ? { success: true, revokedSessionCount: 1 }
        : operation === "single session"
          ? { success: true, scope: "single", sessionId: otherSession.id }
          : { success: true, scope: "others", revokedCount: 1 };
    harness.fetch
      .mockResolvedValueOnce(response(success))
      .mockResolvedValueOnce(response({ actorId: "usr_other", sessions: [] }));
    if (operation === "password") {
      const form = findNamed(render(), "SettingsPasswordForm");
      await (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
        preventDefault() {},
      });
    } else {
      const sessions = findNamed(render(), "SettingsActiveSessions");
      if (operation === "single session")
        await (sessions.props.onRevokeSession as (id: string, label: string) => Promise<void>)(
          otherSession.id,
          otherSession.userAgent,
        );
      else await (sessions.props.onRevokeOthers as () => Promise<void>)();
    }
    await vi.waitFor(() => expect(harness.slots[4]).toBe(true));
    expect(harness.slots[0]).toBeNull();
    expect(harness.slots[1]).toBeNull();
    expect(harness.slots[9]).toEqual({ currentPassword: "", newPassword: "" });
    expect(harness.slots[10]).toBeNull();
    expect(harness.slots[11]).toBe("");
    expect(harness.slots[12]).toBeNull();
    expect(findNamed(render(), "ErrorState").props.title).toContain(
      getDictionary("en").settings.settingsAccountChanged,
    );
    expect(render().some((node) => componentName(node.type) === "SettingsPasswordForm")).toBe(
      false,
    );
  },
);

it("keeps the actor from the confirmed session list if the account changes during confirmation", async () => {
  let confirm!: (value: boolean) => void;
  confirmAction.mockReturnValueOnce(new Promise<boolean>((resolve) => (confirm = resolve)));
  harness.fetch.mockResolvedValueOnce(response({ error: "Account changed" }, 409));
  const sessions = findNamed(render(), "SettingsActiveSessions");
  const pending = (sessions.props.onRevokeOthers as () => Promise<void>)();
  harness.slots[1] = { actorId: "usr_other", sessions: [otherSession] };
  render();
  confirm(true);
  await pending;
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledOnce());
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/auth/sessions",
    expect.objectContaining({
      method: "DELETE",
      body: JSON.stringify({ allOther: true, expectedActorId: "usr_owner" }),
    }),
  );
});
