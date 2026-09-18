"use client";

import React from "react";
import Link from "next/link";
import { Search, User as UserIcon } from "lucide-react";
import { CommandPalette } from "./command-palette";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";

export function Navbar() {
  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-base bg-surface/95 backdrop-blur">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Global Search — the primary topbar element */}
          <div className="flex-1 max-w-xl">
            <NavbarSearchTrigger />
          </div>

          {/* Right cluster: theme, notifications, account */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <Link
              href="/auth/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent hover:bg-[var(--nexus-accent-hover)] text-white text-xs font-semibold shadow-nexus-sm transition-colors"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}

function NavbarSearchTrigger() {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setIsSearchOpen(true)}
        className="w-full flex items-center justify-between px-3 py-1.5 rounded-md bg-inset border border-base text-muted text-xs hover:border-strong transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5" />
          <span>Search servers, resources, creators...</span>
        </span>
        <kbd className="px-1.5 py-0.5 text-[10px] font-numeric bg-elevated text-muted rounded border border-base">
          Ctrl K
        </kbd>
      </button>
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
