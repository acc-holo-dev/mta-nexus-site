import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shellNavigation } from "../../src/features/shell/components/shell-navigation";
import type { ShellAuthSession } from "../../src/features/shell/session";
import { getDictionary } from "../../src/lib/i18n";

const nav = vi.hoisted(() => ({ pathname: "/servers" }));
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

vi.mock("../../src/features/shell/auth-session", () => ({
  useAuthSession: () => auth.session,
}));

import { NexusShell } from "../../src/features/shell/shell";
import { Sidebar } from "../../src/features/shell/sidebar";

describe("desktop sidebar scroll rail", () => {
  beforeEach(() => {
    nav.pathname = "/servers";
    auth.session = { status: "anonymous", user: null };
  });

  it("pins the rail to the viewport and scrolls the destination list inside it", () => {
    const html = renderToStaticMarkup(
      React.createElement(Sidebar, {
        locale: "en",
        isCollapsed: false,
        onToggle: () => undefined,
      }),
    );

    expect(html).toMatch(/<aside[^>]*class="[^"]*sticky top-0[^"]*h-dvh[^"]*self-start/);
    expect(html).toMatch(/<nav[^>]*class="[^"]*min-h-0[^"]*overflow-y-auto[^"]*overscroll-contain/);
    expect(html).toMatch(/href="\/servers"[^>]*class="[^"]*px-1/);
  });

  it("keeps the desktop rail outside the scrolling main column", () => {
    const html = renderToStaticMarkup(
      <NexusShell locale="en">
        <p>Page</p>
      </NexusShell>,
    );

    expect(html).toMatch(
      /<div class="flex h-dvh min-h-0 overflow-hidden bg-page text-primary"><aside[^>]*class="[^"]*sticky top-0[^"]*lg:flex/,
    );
    expect(html).toMatch(
      /<div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain[^"]*">/,
    );
    expect(html).toMatch(/<nav class="fixed inset-x-0 bottom-0[^"]*lg:hidden"/);
  });

  it("puts finance in the signed-in shell and the wallet only when the engine flag is on", () => {
    auth.session = { status: "authenticated", user: { username: "demo", role: "user" } };
    const dictionary = getDictionary("en");
    const signedIn = renderToStaticMarkup(
      React.createElement(Sidebar, {
        locale: "en",
        isCollapsed: false,
        onToggle: () => undefined,
        walletEnabled: true,
      }),
    );
    const walletOff = renderToStaticMarkup(
      React.createElement(Sidebar, {
        locale: "en",
        isCollapsed: false,
        onToggle: () => undefined,
        walletEnabled: false,
      }),
    );

    expect(signedIn).toContain(`href="/workspace/wallet"`);
    expect(signedIn).toContain(dictionary.nav.siteWallet);
    expect(signedIn).toContain(`href="/workspace/finance"`);
    expect(walletOff).not.toContain(`href="/workspace/wallet"`);
    expect(walletOff).toContain(`href="/workspace/finance"`);
    expect(shellNavigation("ru", { walletEnabled: true }).account.map((item) => item.href)).toEqual(
      ["/workspace/wallet", "/workspace/finance", "/notifications", "/security", "/settings"],
    );
    expect(
      shellNavigation("en").mobileWorkspace.some((item) => item.href === "/workspace/wallet"),
    ).toBe(false);
    expect(
      shellNavigation("en", { walletEnabled: true }).mobileWorkspace.some(
        (item) => item.href === "/workspace/wallet",
      ),
    ).toBe(true);
  });
});
