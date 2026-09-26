"use client";

import React, { useEffect, useState } from "react";
import { Footer } from "./footer";
import { MobileNav } from "./mobile-nav";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";
import { getDictionary, type Locale } from "../lib/i18n";
import { LocaleProvider } from "./locale-context";

export function NexusShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const dictionary = getDictionary(locale);

  useEffect(() => {
    const stored = localStorage.getItem("nexus-sidebar-collapsed");
    if (stored === "true") setIsSidebarCollapsed(true);
  }, []);

  const toggle = () => {
    setIsSidebarCollapsed((previous) => {
      const next = !previous;
      localStorage.setItem("nexus-sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <LocaleProvider locale={locale}>
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-md bg-accent px-3 py-2 text-xs font-bold text-white shadow-nexus transition-transform focus:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {dictionary.nav.skipToContent}
      </a>

      <div className="min-h-screen bg-page text-primary">
        <div className="flex min-h-screen">
          <Sidebar
            locale={locale}
            isCollapsed={isSidebarCollapsed}
            onToggle={toggle}
          />

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
