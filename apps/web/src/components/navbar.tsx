"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { AccountControls } from "./account-controls";
import { LocaleSwitcher } from "./locale-switcher";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { getDictionary, type Locale } from "../lib/i18n";

export function Navbar({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-base bg-surface/95 backdrop-blur">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] lg:hidden"
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

        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
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
  return (
    <Link
      href="/discover"
      className="flex w-full items-center gap-2 rounded-md border border-base bg-inset px-3 py-1.5 text-xs text-muted transition-colors hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      aria-label={placeholder}
    >
      <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{placeholder}</span>
    </Link>
  );
}
