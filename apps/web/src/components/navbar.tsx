"use client";

import React from "react";
import { Search } from "lucide-react";
import { CommandPalette } from "./command-palette";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { AccountControls } from "./account-controls";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-base bg-surface/95 backdrop-blur">
      <div className="px-4 sm:px-6 min-h-14 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 max-w-xl"><NavbarSearchTrigger /></div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
          <AccountControls />
        </div>
      </div>
    </header>
  );
}

function NavbarSearchTrigger() {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  return (
    <>
      <button
        onClick={() => setIsSearchOpen(true)}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-inset border border-base text-muted text-xs hover:border-strong transition-colors cursor-pointer"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Search servers, resources, creators...</span>
        </span>
        <kbd className="hidden sm:block shrink-0 px-1.5 py-0.5 text-[10px] font-numeric bg-elevated text-muted rounded border border-base">Ctrl K</kbd>
      </button>
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
