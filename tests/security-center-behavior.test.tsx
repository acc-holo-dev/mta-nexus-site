import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as null | {
    id: string;
    email: string;
    username: string;
    role: string;
  },
}));

const auth = vi.hoisted(() => ({
  getSessionIdentity: vi.fn(),
  getSession: vi.fn(),
  listSessions: vi.fn(),
  getCurrentSessionId: vi.fn(),
  getRecoveryEmailStatus: vi.fn(),
}));

const auditList = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "nexus_session" && state.user ? { value: "session-token" } : undefined,
  })),
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children: ReactNode;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: auth,
}));

vi.mock("@nexus/db", () => ({
  auditRepository: {
    listAccountActivity: auditList,
  },
}));

import SecurityPage from "../apps/web/src/app/security/page";
import { SECURITY_ACTIVITY_ACTIONS } from "../apps/web/src/lib/security-activity";
import { SecurityCenterService } from "../apps/web/src/lib/services/security-center-service";

describe("Security Center behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = null;
    auth.getSession.mockImplementation(async () => state.user);
    auth.getSessionIdentity.mockImplementation(async () =>
      state.user ? { user: state.user, sessionId: "ses_current" } : null,
    );
    auth.listSessions.mockResolvedValue([]);
    auth.getCurrentSessionId.mockResolvedValue(null);
    auth.getRecoveryEmailStatus.mockResolvedValue(null);
    auditList.mockResolvedValue([]);
  });

  it("renders a sign-in boundary without reading private security data", async () => {
    const html = renderToStaticMarkup(await SecurityPage());

    expect(html).toContain('href="/auth/login"');
    expect(auth.listSessions).not.toHaveBeenCalled();
    expect(auth.getRecoveryEmailStatus).not.toHaveBeenCalled();
  });

  it("loads sessions, recovery state and actor-scoped activity for the authenticated user", async () => {
    state.user = {
      id: "usr_security",
      email: "security@example.test",
      username: "security",
      role: "user",
    };
    auth.listSessions.mockResolvedValue([
      {
        id: "ses_current",
        userAgent: "Test Browser",
        ipAddress: "203.0.113.10",
        createdAt: new Date("2026-10-01T00:00:00.000Z"),
        expiresAt: new Date("2026-11-01T00:00:00.000Z"),
      },
    ]);
    auth.getCurrentSessionId.mockResolvedValue("ses_current");
    auth.getRecoveryEmailStatus.mockResolvedValue({
      email: "recovery@example.test",
      verified: true,
    });
    auditList.mockResolvedValue([
      {
        id: "aud_1",
        actorId: "usr_security",
        action: "user.logged_in",
        targetType: "user",
        ipAddress: "203.0.113.10",
        userAgent: "Test Browser",
        createdAt: new Date("2026-10-08T00:00:00.000Z"),
      },
      {
        id: "aud_removed",
        actorId: "usr_admin",
        action: "organization.member_removed",
        targetType: "organization",
        ipAddress: "198.51.100.8",
        userAgent: "Staff Browser",
        details: { userId: "usr_security", note: "private-note" },
        createdAt: new Date("2026-10-08T00:00:01.000Z"),
      },
    ]);

    const html = renderToStaticMarkup(await SecurityPage());

    expect(auth.listSessions).toHaveBeenCalledWith("usr_security");
    expect(auth.getSessionIdentity).toHaveBeenCalledOnce();
    expect(auth.getSessionIdentity).toHaveBeenCalledWith("session-token");
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(auth.getCurrentSessionId).not.toHaveBeenCalled();
    expect(auth.getRecoveryEmailStatus).toHaveBeenCalledWith("usr_security");
    expect(auditList).toHaveBeenCalledWith("usr_security", [...SECURITY_ACTIVITY_ACTIONS], 30);
    expect(html).toContain("recovery@example.test");
    expect(html).toContain("Test Browser");
    expect(html).toContain("203.0.113.10");
    expect(html).toContain("You were removed from an organization");
    expect(html).not.toContain("usr_admin");
    expect(html).not.toContain("private-note");
    expect(html).not.toContain("198.51.100.8");
    expect(html).not.toContain("Staff Browser");
    expect(html).toContain('href="/settings"');
  });

  it("bounds audit reads to the security allowlist and strips raw event details", async () => {
    auditList.mockResolvedValue([
      {
        id: "aud_allowed",
        actorId: "usr_security",
        action: "user.logged_in",
        targetType: "user",
        details: { secret: "must-not-leak" },
        createdAt: new Date("2026-10-08T00:00:00.000Z"),
      },
      {
        id: "aud_license",
        actorId: "usr_security",
        action: "license.bound",
        targetType: "license",
        details: { reason: "bind", secret: "license-detail" },
        createdAt: new Date("2026-10-08T00:00:00.500Z"),
      },
      {
        id: "aud_other",
        actorId: "usr_security",
        action: "product.updated",
        targetType: "product",
        details: { secret: "also-hidden" },
        createdAt: new Date("2026-10-08T00:00:01.000Z"),
      },
      {
        id: "aud_foreign_login",
        actorId: "usr_other",
        action: "user.logged_in",
        targetType: "user",
        ipAddress: "198.51.100.9",
        createdAt: new Date("2026-10-08T00:00:02.000Z"),
      },
    ]);

    const service = new SecurityCenterService();
    const result = await service.listActivity("usr_security", 999);

    expect(auditList).toHaveBeenCalledWith("usr_security", [...SECURITY_ACTIVITY_ACTIONS], 50);
    expect(result).toEqual([
      expect.objectContaining({
        id: "aud_allowed",
        action: "user.logged_in",
      }),
      expect.objectContaining({
        id: "aud_license",
        action: "license.bound",
        targetType: "license",
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
    expect(JSON.stringify(result)).not.toContain("license-detail");
    expect(JSON.stringify(result)).not.toContain("aud_foreign_login");
    expect(result.map((item) => item.perspective)).toEqual(["actor", "actor"]);
  });
});
