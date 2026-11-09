import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShellAuthSession } from "../../apps/web/src/components/shell-destination-policy";
import { getDictionary } from "../../apps/web/src/lib/i18n";

const nav = vi.hoisted(() => ({ pathname: "/market" }));
const auth = vi.hoisted(() => ({
  session: { status: "anonymous", user: null } as ShellAuthSession,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => ReactModule.createElement("a", { href, ...props }, children),
  };
});

vi.mock("../../apps/web/src/components/use-auth-session", () => ({
  useAuthSession: () => auth.session,
}));

vi.mock("../../apps/web/src/components/account-controls", async () => {
  const ReactModule = await import("react");
  return {
    AccountControls: () => ReactModule.createElement("span", { "data-mock": "account" }),
  };
});

vi.mock("../../apps/web/src/components/locale-switcher", async () => {
  const ReactModule = await import("react");
  return {
    LocaleSwitcher: () => ReactModule.createElement("span", { "data-mock": "locale" }),
  };
});

vi.mock("../../apps/web/src/components/notification-bell", async () => {
  const ReactModule = await import("react");
  return {
    NotificationBell: () => ReactModule.createElement("span", { "data-mock": "notifications" }),
  };
});

vi.mock("../../apps/web/src/components/theme-toggle", async () => {
  const ReactModule = await import("react");
  return {
    ThemeToggle: () => ReactModule.createElement("span", { "data-mock": "theme" }),
  };
});

import { MobileNav } from "../../apps/web/src/components/mobile-nav";
import { NexusShell } from "../../apps/web/src/components/nexus-shell";
import { Sidebar } from "../../apps/web/src/components/sidebar";

describe("pre-release shell accessibility behavior", () => {
  beforeEach(() => {
    nav.pathname = "/market";
    auth.session = { status: "anonymous", user: null };
  });

  it.each(["en", "ru"] as const)(
    "renders a localized skip link targeting the focusable main landmark in %s",
    (locale) => {
      const dictionary = getDictionary(locale);
      const html = renderToStaticMarkup(
        <NexusShell locale={locale}>
          <h1>Fixture</h1>
        </NexusShell>,
      );

      expect(html).toMatch(
        new RegExp(`<a[^>]*href="#main-content"[^>]*>${dictionary.nav.skipToContent}</a>`, "u"),
      );
      expect(html).toMatch(/<main[^>]*id="main-content"[^>]*tabindex="-1"/u);
      expect(html).toContain("<h1>Fixture</h1>");
    },
  );

  it("keeps full app chrome on auth routes so theme and banner sign-in stay available", () => {
    nav.pathname = "/auth/login";
    const dictionary = getDictionary("en");
    const html = renderToStaticMarkup(
      <NexusShell locale="en">
        <h1>Sign in</h1>
      </NexusShell>,
    );

    expect(html).toMatch(
      new RegExp(`<a[^>]*href="#main-content"[^>]*>${dictionary.nav.skipToContent}</a>`, "u"),
    );
    expect(html).toMatch(/<main[^>]*id="main-content"[^>]*tabindex="-1"/u);
    expect(html).toContain("<h1>Sign in</h1>");
    expect(html).toContain('href="/discover"');
    expect(html).toContain(`aria-label="${dictionary.nav.ecosystem}"`);
  });

  it("marks the active mobile destination and keeps the More dialog relation closed until opened", () => {
    const dictionary = getDictionary("en");
    const html = renderToStaticMarkup(React.createElement(MobileNav, { locale: "en" }));

    expect(html).toMatch(/<a[^>]*href="\/market"[^>]*aria-current="page"/u);
    expect(html).toContain(`aria-label="${dictionary.nav.ecosystem}"`);
    expect(html).toMatch(
      new RegExp(`<button[^>]*aria-expanded="false"[^>]*>.*?${dictionary.nav.more}`, "su"),
    );
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain('aria-controls="mobile-more-menu"');
    expect(html).not.toContain('id="mobile-more-menu"');
  });

  it("gives collapsed sidebar destinations accessible names for guests without Workspace or Admin", () => {
    const dictionary = getDictionary("en");
    const html = renderToStaticMarkup(
      React.createElement(Sidebar, {
        locale: "en",
        isCollapsed: true,
        onToggle: () => undefined,
      }),
    );

    expect(html).toMatch(
      new RegExp(`<a[^>]*href="/discover"[^>]*aria-label="${dictionary.nav.explore}"`, "u"),
    );
    expect(html).toMatch(
      new RegExp(
        `<a[^>]*href="/auth/login\\?next=%2Fmarket"[^>]*aria-label="${dictionary.workspace.signIn}"`,
        "u",
      ),
    );
    expect(html).not.toContain('href="/admin"');
    expect(html).not.toContain('href="/workspace"');
    expect(html).not.toContain('href="/workspace/servers"');
    expect(html).not.toContain(dictionary.nav.workspace);
    expect(html).toMatch(new RegExp(`<button[^>]*aria-label="${dictionary.nav.expand}"`, "u"));
  });

  it("exposes Admin only for staff roles in collapsed sidebar", () => {
    const dictionary = getDictionary("en");
    auth.session = {
      status: "authenticated",
      user: { username: "mod", role: "moderator" },
    };
    const html = renderToStaticMarkup(
      React.createElement(Sidebar, {
        locale: "en",
        isCollapsed: true,
        onToggle: () => undefined,
      }),
    );

    const staffAdminLabel = `${dictionary.nav.admin} (${dictionary.nav.adminStaffHint})`;
    expect(html).toContain(`href="/admin"`);
    expect(html).toContain(`aria-label="${staffAdminLabel}"`);
    expect(html).toContain('href="/workspace/servers"');
  });
});
