"use client";

import React, { useEffect, useState } from "react";
import { Footer } from "./footer";
import { MobileNav } from "./mobile-nav";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";
import type { Locale } from "../lib/i18n";

export function NexusShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
    <div className="min-h-screen bg-page text-primary">
      <div className="flex min-h-screen">
        <Sidebar
          locale={locale}
          isCollapsed={isSidebarCollapsed}
          onToggle={toggle}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar locale={locale} />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-6">
            {children}
          </main>
          <Footer locale={locale} />
        </div>
      </div>
      <MobileNav locale={locale} />
    </div>
  );
}
