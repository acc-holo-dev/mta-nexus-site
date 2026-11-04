import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as Array<undefined | (() => void)>,
  effect: null as null | (() => undefined | (() => void)),
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [
      harness.slots[index],
      (value: unknown) => {
        harness.slots[index] =
          typeof value === "function"
            ? (value as (current: unknown) => unknown)(harness.slots[index])
            : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = { current: initial };
    return harness.slots[index];
  },
  useMemo: (factory: () => unknown) => factory(),
  useEffect: (effect: () => undefined | (() => void)) => {
    // Individual bootstrap tests invoke the effect explicitly.
    harness.effect = effect;
  },
}));
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

type Element = ReactElement<Record<string, unknown>>;

function componentName(type: Element["type"]): string | undefined {
  if (typeof type === "string") return type;
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name;
  }
  if (typeof type === "object" && type !== null) {
    return (type as { displayName?: string }).displayName;
  }
  return undefined;
}

function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...descendants(element.props.children as ReactNode)];
}

function findNamed(nodes: Element[], name: string) {
  const found = nodes.find((node) => componentName(node.type) === name);
  if (!found) throw new Error(`Missing ${name}`);
  return found;
}

const preferences = {
  followsEnabled: true,
  contentEnabled: true,
  serverEnabled: true,
  commerceEnabled: true,
  systemEnabled: true,
};

const otherSession = {
  id: "sess_other",
  expiresAt: "2026-12-01T00:00:00.000Z",
  ipAddress: "203.0.113.10",
  userAgent: "Other Browser",
  createdAt: "2026-10-01T00:00:00.000Z",
  isCurrent: false,
};

function seedLoadedSettings() {
  harness.slots = [
    preferences,
    { actorId: "usr_owner", sessions: [otherSession] },
    false,
    false,
    false,
    0,
    null,
    false,
    { current: false },
    { currentPassword: "current-pass", newPassword: "replacement-pass" },
    {
      actorId: "usr_owner",
      email: "member@example.com",
      verified: true,
      verifiedAt: "2026-09-01T00:00:00.000Z",
      eligible: true,
    },
    "",
    "usr_owner",
  ];
}

function render() {
  harness.cursor = 0;
  return descendants(SettingsPageClient());
}

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  harness.cursor = 0;
  harness.cleanups = [];
  harness.effect = null;
  seedLoadedSettings();
  confirmAction.mockResolvedValue(true);
  harness.fetch.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
});

it("does not render recovery email from another account during settings load", async () => {
  harness.fetch
    .mockResolvedValueOnce(response({ actorId: "usr_owner", preferences }))
    .mockResolvedValueOnce(response({ actorId: "usr_owner", sessions: [otherSession] }))
    .mockResolvedValueOnce(
      response({
        actorId: "usr_other",
        email: "other@example.com",
        verified: true,
        verifiedAt: null,
        eligible: true,
      }),
    );
  render();
  if (!harness.effect) throw new Error("Missing settings loading effect");
  harness.cleanups.push(harness.effect());
  await vi.waitFor(() => expect(findNamed(render(), "ErrorState")).toBeDefined());
  expect(render().some((node) => componentName(node.type) === "SettingsRecoveryEmailSection")).toBe(
    false,
  );
});

it("discards a recovery status fetched after an account switch", async () => {
  harness.fetch
    .mockResolvedValueOnce(response({ accepted: false, alreadyVerified: true }))
    .mockResolvedValueOnce(
      response({
        actorId: "usr_other",
        email: "other@example.com",
        verified: true,
        verifiedAt: null,
        eligible: true,
      }),
    );
  const section = findNamed(render(), "SettingsRecoveryEmailSection");
  (section.props.onSubmit as (event: { preventDefault: () => void }) => void)({
    preventDefault() {},
  });
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());
  expect(harness.fetch.mock.calls[0][1].body).toBe(
    JSON.stringify({ currentPassword: "", expectedActorId: "usr_owner" }),
  );
  await vi.waitFor(() => expect(findNamed(render(), "ErrorState")).toBeDefined());
  expect(render().some((node) => componentName(node.type) === "SettingsRecoveryEmailSection")).toBe(
    false,
  );
  expect(findNamed(render(), "ErrorState").props.title).toBe(
    getDictionary("en").settings.recoveryAccountChanged,
  );
});

it("hides stale settings when recovery email request rejects a switched account", async () => {
  harness.fetch.mockResolvedValueOnce(
    response({ code: "ACTOR_CHANGED", error: "Account changed" }, 409),
  );
  const section = findNamed(render(), "SettingsRecoveryEmailSection");
  (section.props.onSubmit as (event: { preventDefault: () => void }) => void)({
    preventDefault() {},
  });
  await vi.waitFor(() => expect(findNamed(render(), "ErrorState")).toBeDefined());
  expect(render().some((node) => componentName(node.type) === "SettingsRecoveryEmailSection")).toBe(
    false,
  );
  expect(findNamed(render(), "ErrorState").props.title).toBe(
    getDictionary("en").settings.recoveryAccountChanged,
  );
});

afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup?.();
  vi.unstubAllGlobals();
});

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
