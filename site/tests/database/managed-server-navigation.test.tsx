import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { ShellAuthSession } from "../../src/components/shell-destination-policy";

const state = vi.hoisted(() => ({
  path: "/workspace/servers",
  session: {
    status: "authenticated",
    user: { username: "owner", role: "user" },
  } as ShellAuthSession,
}));

vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
vi.mock("../../src/components/use-auth-session", () => ({
  useAuthSession: () => state.session,
}));

import { FooterContribute } from "../../src/components/footer-contribute";
import {
  adminDestinationAccessibleName,
  isShellSessionLoading,
  isStaffRole,
  shellDestinationActive,
  showAdminDestination,
  showGuestSignInCta,
  showWorkspaceTools,
} from "../../src/components/shell-destination-policy";
import { Sidebar } from "../../src/components/sidebar";
import { getDictionary } from "../../src/lib/i18n";

beforeEach(() => {
  state.path = "/workspace/servers";
  state.session = {
    status: "authenticated",
    user: { username: "owner", role: "user" },
  };
});

it.each(["en", "ru"] as const)("exposes a localized managed-server destination in %s", (locale) => {
  state.path = "/workspace/servers";
  const html = renderToStaticMarkup(
    <Sidebar locale={locale} isCollapsed={false} onToggle={() => {}} />,
  );
  expect(html).toContain(locale === "ru" ? "Кабинет" : "Overview");
  expect(html).toContain(locale === "ru" ? "Обзор" : "Discover");
  expect(html).toContain(locale === "ru" ? "Управляемые серверы" : "Managed servers");
  expect(html).toContain(locale === "ru" ? "Библиотека ресурсов" : "Resource library");
  expect(html).toContain('href="/workspace/library"');
  expect(html).toContain('href="/workspace/servers"');
  expect(html).toContain('href="/support"');
  expect(html).not.toContain('href="/admin"');
});

it("hides managed-server tools for guests and keeps a sign-in CTA", () => {
  state.session = { status: "anonymous", user: null };
  const html = renderToStaticMarkup(
    <Sidebar locale="en" isCollapsed={false} onToggle={() => {}} />,
  );
  expect(html).not.toContain('href="/workspace/servers"');
  expect(html).not.toContain('href="/workspace/library"');
  expect(html).toContain('href="/support"');
  expect(html).toContain('href="/auth/login?next=%2Fworkspace%2Fservers"');
  expect(html).toContain("Sign in");
});

it.each([
  ["/workspace/servers", "/workspace/servers"],
  ["/workspace/servers/srv_1", "/workspace/servers"],
  ["/workspace/servers/new", "/workspace/servers/new"],
  ["/workspace", "/workspace"],
])("marks one current workspace destination on %s", (path, expected) => {
  state.path = path;
  const html = renderToStaticMarkup(<Sidebar locale="en" isCollapsed onToggle={() => {}} />);
  const active = html.match(/<a\b[^>]*aria-current="page"[^>]*>/g) ?? [];
  expect(active).toHaveLength(1);
  expect(active[0]).toContain(`href="${expected}"`);
});

it("applies UX-23 A staff/guest destination policy without inventing roles", () => {
  expect(isStaffRole("admin")).toBe(true);
  expect(isStaffRole("moderator")).toBe(true);
  expect(isStaffRole("user")).toBe(false);
  expect(showWorkspaceTools({ status: "loading", user: null })).toBe(false);
  expect(showWorkspaceTools({ status: "anonymous", user: null })).toBe(false);
  expect(isShellSessionLoading({ status: "loading", user: null })).toBe(true);
  expect(showGuestSignInCta({ status: "loading", user: null })).toBe(false);
  expect(showGuestSignInCta({ status: "anonymous", user: null })).toBe(true);
  expect(
    showAdminDestination({
      status: "authenticated",
      user: { username: "a", role: "user" },
    }),
  ).toBe(false);
  expect(
    showAdminDestination({
      status: "authenticated",
      user: { username: "a", role: "admin" },
    }),
  ).toBe(true);
  expect(adminDestinationAccessibleName("Admin", "Staff only")).toBe("Admin (Staff only)");
  expect(shellDestinationActive("/settings", "/settings/developer")).toBe(false);
  expect(shellDestinationActive("/settings/developer", "/settings/developer")).toBe(true);
  expect(shellDestinationActive("/settings", "/settings/privacy")).toBe(true);
  expect(shellDestinationActive("/workspace/servers", "/workspace/servers/new")).toBe(false);
  expect(shellDestinationActive("/workspace/servers/new", "/workspace/servers/new")).toBe(true);
});

it("keeps mobile More menu session checking and staff admin labels in source", () => {
  const source = readFileSync(resolve(process.cwd(), "site/src/components/mobile-nav.tsx"), "utf8");
  expect(source).toContain("dictionary.nav.checkingSession");
  expect(source).toContain('href: "/workspace/library"');
  expect(source).toContain('href: "/workspace/resources/new"');
  expect(source).toContain('href: "/workspace/servers/new"');
  expect(source).toContain("getManagedServerCopy");
  expect(source).toContain("adminAccessibleName");
  expect(source).toContain('aria-busy="true"');
  expect(source).toContain("aria-label={adminAccessibleName}");
});

it("shows session checking chrome without workspace, sign-in, or admin while loading", () => {
  state.session = { status: "loading", user: null };
  const dictionary = getDictionary("en");
  const html = renderToStaticMarkup(
    <Sidebar locale="en" isCollapsed={false} onToggle={() => {}} />,
  );
  expect(html).toContain('role="status"');
  expect(html).toContain(dictionary.nav.checkingSession);
  expect(html).toContain('aria-busy="true"');
  expect(html).not.toContain('href="/workspace"');
  expect(html).not.toContain('href="/auth/login');
  expect(html).not.toContain('href="/admin"');
});

it("keeps one current destination on the developer profile and names staff admin", () => {
  state.path = "/settings/developer";
  const dictionary = getDictionary("en");
  const html = renderToStaticMarkup(
    <Sidebar locale="en" isCollapsed={false} onToggle={() => {}} />,
  );
  const active = html.match(/<a\b[^>]*aria-current="page"[^>]*>/g) ?? [];
  expect(active).toHaveLength(1);
  expect(active[0]).toContain('href="/settings/developer"');

  state.session = {
    status: "authenticated",
    user: { username: "mod", role: "moderator" },
  };
  state.path = "/admin";
  const staff = renderToStaticMarkup(
    <Sidebar locale="en" isCollapsed={false} onToggle={() => {}} />,
  );
  expect(staff).toContain(
    `aria-label="${dictionary.nav.admin} (${dictionary.nav.adminStaffHint})"`,
  );
});

it("shows footer workspace links only for a confirmed member", () => {
  state.session = { status: "loading", user: null };
  const loading = renderToStaticMarkup(<FooterContribute locale="en" />);
  expect(loading).toContain("Checking session...");
  expect(loading).not.toContain('href="/workspace');

  state.session = { status: "anonymous", user: null };
  const guest = renderToStaticMarkup(<FooterContribute locale="en" />);
  expect(guest).not.toContain('href="/workspace');
  expect(guest).toContain('href="/auth/login?next=%2Fworkspace%2Fservers"');

  state.session = {
    status: "authenticated",
    user: { username: "owner", role: "user" },
  };
  const member = renderToStaticMarkup(<FooterContribute locale="en" />);
  expect(member).toContain('href="/workspace/servers/new"');
  expect(member).toContain('href="/workspace/resources/new"');
  expect(member).toContain('href="/workspace"');
});
