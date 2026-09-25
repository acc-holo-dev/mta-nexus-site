"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, LayoutDashboard, MessageSquare, Server } from "lucide-react";
import { getDictionary, type Locale } from "../lib/i18n";

export function MobileNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const dictionary = getDictionary(locale);
  const items = [
    { href: "/", label: dictionary.nav.home, icon: Home },
    { href: "/servers", label: dictionary.nav.liveServers, icon: Server },
    { href: "/market", label: dictionary.nav.freeResources, icon: Library },
    { href: "/community", label: dictionary.nav.community, icon: MessageSquare },
    { href: "/workspace", label: dictionary.nav.workspace, icon: LayoutDashboard },
  ];

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-base bg-surface/95 px-1 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-1 backdrop-blur lg:hidden"
      aria-label={dictionary.nav.ecosystem}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] font-semibold transition-colors ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-hover hover:text-primary"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
