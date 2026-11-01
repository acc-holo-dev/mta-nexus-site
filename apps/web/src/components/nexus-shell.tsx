"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { Footer } from "./footer";
import { MobileNav } from "./mobile-nav";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";
import { getDictionary, type Locale } from "../lib/i18n";
import { LocaleProvider } from "./locale-context";

function isAuthShellPath(pathname: string | null): boolean {
  return pathname === "/auth" || (pathname?.startsWith("/auth/") ?? false);
}

export function NexusShell({ children, locale }: { children: ReactNode; locale: Locale }) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const dictionary = getDictionary(locale);
  const isAuthRoute = isAuthShellPath(pathname);

  useEffect(() => {
    try {
      if (localStorage.getItem("nexus-sidebar-collapsed") === "true") setIsSidebarCollapsed(true);
    } catch {
      // The sidebar remains usable when browser storage is unavailable.
    }
  }, []);

  const toggle = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    try {
      localStorage.setItem("nexus-sidebar-collapsed", String(next));
    } catch {
      // Keep this page's choice even if persistence is blocked.
    }
  };

  const skipLink = (
    <a
      href="#main-content"
      className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-md bg-accent px-3 py-2 text-xs font-bold text-white shadow-nexus transition-transform focus:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {dictionary.nav.skipToContent}
    </a>
  );

  if (isAuthRoute) {
    return (
      <LocaleProvider locale={locale}>
        {skipLink}
        <div className="min-h-screen bg-page text-primary">
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-6 outline-none sm:px-6"
          >
            {children}
          </main>
        </div>
      </LocaleProvider>
    );
  }

  return (
    <LocaleProvider locale={locale}>
      {skipLink}
      <div className="min-h-screen bg-page text-primary">
        <div className="flex min-h-screen">
          <Sidebar locale={locale} isCollapsed={isSidebarCollapsed} onToggle={toggle} />

          <div className="flex min-w-0 flex-1 flex-col">
            <Navbar locale={locale} />
            <main
              id="main-content"
              tabIndex={-1}
              className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 outline-none sm:px-6 lg:pb-6"
            >
              {children}
            </main>
            <Footer locale={locale} />
          </div>
        </div>
        <MobileNav locale={locale} />
      </div>
    </LocaleProvider>
  );
}
