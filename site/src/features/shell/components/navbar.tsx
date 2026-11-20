"use client";

import { BrandMark } from "@nexus/ui";
import { Search } from "lucide-react";
import Link from "next/link";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { AccountControls } from "../../accounts/controls";
import { NotificationBell } from "../../notifications/bell";
import { typeH35W35Shrink } from "../type-shell";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

export function Navbar({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-base bg-surface/95 backdrop-blur">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-6">
        <BrandMark href="/" className="lg:hidden" wordmarkClassName="hidden sm:inline" />

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
      <Search className={typeH35W35Shrink} aria-hidden="true" />
      <span className="truncate">{placeholder}</span>
    </Link>
  );
}
