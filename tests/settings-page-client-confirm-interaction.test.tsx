import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as Array<undefined | (() => void)>,
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
  useEffect: () => {
    // Loaded settings state is seeded below; skip the network bootstrap for confirm coverage.
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
    [otherSession],
    false,
    false,
    false,
    0,
    null,
    false,
    { current: false },
    { currentPassword: "current-pass", newPassword: "replacement-pass" },
    {
      email: "member@example.com",
      verified: true,
      verifiedAt: "2026-09-01T00:00:00.000Z",
      eligible: true,
    },
    "",
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
  seedLoadedSettings();
  confirmAction.mockResolvedValue(true);
  harness.fetch.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
});

afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup?.();
  vi.unstubAllGlobals();
});

it("confirms a password change before posting the update", async () => {
  const copy = getDictionary("en").settings;
  harness.fetch
    .mockResolvedValueOnce(response({ success: true, revokedSessionCount: 2 }))
    .mockResolvedValueOnce(response({ sessions: [otherSession] }));

  const form = findNamed(render(), "SettingsPasswordForm");
  await (
    form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>
  )({ preventDefault() {} });
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
      }),
    }),
  );
});

it("does not change the password when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  const form = findNamed(render(), "SettingsPasswordForm");
  await (
    form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>
  )({ preventDefault() {} });
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("confirms ending another session before DELETE", async () => {
  const copy = getDictionary("en").settings;
  harness.fetch
    .mockResolvedValueOnce(
      response({ success: true, scope: "single", sessionId: otherSession.id }),
    )
    .mockResolvedValueOnce(response({ sessions: [] }));

  const sessions = findNamed(render(), "SettingsActiveSessions");
  await (
    sessions.props.onRevokeSession as (sessionId: string, label: string) => Promise<void>
  )(otherSession.id, otherSession.userAgent);
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
      body: JSON.stringify({ sessionId: otherSession.id }),
    }),
  );
});

it("skips session revocation when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  const sessions = findNamed(render(), "SettingsActiveSessions");
  await (
    sessions.props.onRevokeSession as (sessionId: string, label: string) => Promise<void>
  )(otherSession.id, otherSession.userAgent);
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("confirms ending all other sessions before DELETE", async () => {
  const copy = getDictionary("en").settings;
  harness.fetch
    .mockResolvedValueOnce(response({ success: true, scope: "others", revokedCount: 1 }))
    .mockResolvedValueOnce(response({ sessions: [] }));

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
      body: JSON.stringify({ allOther: true }),
    }),
  );
});
