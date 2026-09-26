"use client";

import React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AccountControls } from "./account-controls";
import { CommandPalette } from "./command-palette";
import { LocaleSwitcher } from "./locale-switcher";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { getDictionary, type Locale } from "../lib/i18n";

export function Navbar({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-base bg-surface/95 backdrop-blur">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 lg:hidden"
          aria-label="MTA NEXUS"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-xs font-black text-white shadow-nexus-sm">
            NX
          </span>
          <span className="hidden text-sm font-bold text-primary sm:inline">
            MTA NEXUS
          </span>
        </Link>

        <div className="order-3 min-w-0 basis-full sm:order-none sm:flex-1 lg:max-w-xl">
          <NavbarSearchTrigger placeholder={dictionary.nav.search} />
        </div>

        <div className="flex items-center gap-2">
          <LocaleSwitcher locale={locale} />
          <ThemeToggle />
          <NotificationBell />
          <AccountControls />
        </div>
      </div>
    </header>
  );
}

function NavbarSearchTrigger({ placeholder }: { placeholder: string }) {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchOpen((open) => !open);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsSearchOpen(true)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-base bg-inset px-3 py-1.5 text-xs text-muted transition-colors hover:border-strong"
        aria-haspopup="dialog"
        aria-expanded={isSearchOpen}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{placeholder}</span>
        </span>
        <kbd className="hidden shrink-0 rounded border border-base bg-elevated px-1.5 py-0.5 font-numeric text-[10px] text-muted sm:block">
          Ctrl K
        </kbd>
      </button>
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}
