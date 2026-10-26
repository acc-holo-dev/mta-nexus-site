"use client";

import {
  Bookmark,
  Bell,
  BookOpen,
  Compass,
  Home,
  LayoutDashboard,
  Library,
  LifeBuoy,
  Menu,
  MessageSquare,
  Server,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Code2,
  X,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getDictionary, type Locale } from "../lib/i18n";
import { getOrganizationCopy } from "../lib/organization-workspace-copy";
import { getUserPlatformCopy } from "../lib/user-platform-copy";
import { publicationCopy } from "../lib/publication-feed-copy";
import { reactionCopy } from "../lib/content-reaction-copy";
import { ownDiscussionCopy } from "../lib/discussion-workspace-copy";
import { communityReportCopy } from "../lib/community-report-copy";
import { verificationCopy } from "../lib/verification-workspace-copy";
import { clickedDialogBackdrop, useModalDialog } from "./use-modal-dialog";

export function MobileNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const dictionary = getDictionary(locale);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const dialogRef = useModalDialog(isMoreOpen);

  const items = [
    { href: "/", label: dictionary.nav.home, icon: Home },
    { href: "/servers", label: dictionary.nav.liveServers, icon: Server },
    { href: "/market", label: dictionary.nav.mobileMarket, icon: Library },
    {
      href: "/community",
      label: dictionary.nav.community,
      icon: MessageSquare,
    },
  ];

  const moreItems = [
    { href: "/workspace/discussions", label: ownDiscussionCopy(locale).title, icon: MessageSquare },
    { href: "/workspace/reactions", label: reactionCopy(locale).my, icon: MessageSquare },
    { href: "/workspace/verification", label: verificationCopy(locale).title, icon: ShieldCheck },
    { href: "/settings/developer", label: verificationCopy(locale).profile, icon: Code2 },
    { href: "/workspace/reports", label: communityReportCopy(locale).myReports, icon: ShieldAlert },
    { href: "/workspace/feed", label: publicationCopy(locale).title, icon: MessageSquare },
    { href: "/workspace/saved", label: dictionary.nav.saved, icon: Bookmark },
    { href: "/workspace/organizations", label: getOrganizationCopy(locale).title, icon: Users },
    { href: "/workspace/content", label: getUserPlatformCopy(locale).studio, icon: BookOpen },
    { href: "/discover", label: dictionary.nav.explore, icon: Compass },
    {
      href: "/notifications",
      label: dictionary.nav.notifications,
      icon: Bell,
    },
    {
      href: "/workspace",
      label: dictionary.nav.mobileWorkspace,
      icon: LayoutDashboard,
    },
    { href: "/support", label: dictionary.nav.support, icon: LifeBuoy },
    { href: "/settings", label: dictionary.nav.settings, icon: Settings },
    {
      href: "/security",
      label: dictionary.nav.securityCenter,
      icon: ShieldCheck,
    },
  ];

  const isActive = (href: string) =>
    href === "/" || href === "/workspace"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  const moreActive =
    pathname === "/workspace" ||
    pathname.startsWith("/workspace/") ||
    moreItems.some((item) => isActive(item.href));

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
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[10px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--nexus-accent)] ${
              active ? "bg-accent-soft text-accent" : "text-muted hover:bg-hover hover:text-primary"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={() => setIsMoreOpen(true)}
        aria-current={moreActive ? "page" : undefined}
        aria-expanded={isMoreOpen}
        aria-haspopup="dialog"
        aria-controls={isMoreOpen ? "mobile-more-menu" : undefined}
        className={`flex min-h-12 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[10px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--nexus-accent)] ${
          moreActive ? "bg-accent-soft text-accent" : "text-muted hover:bg-hover hover:text-primary"
        }`}
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
        <span className="max-w-full truncate">{dictionary.nav.more}</span>
      </button>

      {isMoreOpen && (
        <dialog
          ref={dialogRef}
          id="mobile-more-menu"
          aria-modal="true"
          aria-label={dictionary.nav.more}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setIsMoreOpen(false);
            }
          }}
          onCancel={(event) => {
            event.preventDefault();
            setIsMoreOpen(false);
          }}
          onClick={(event) => {
            if (clickedDialogBackdrop(event)) setIsMoreOpen(false);
          }}
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] top-auto m-0 ml-auto mr-auto open:flex w-auto max-w-lg flex-col overflow-hidden rounded-xl border border-strong bg-elevated p-0 text-primary shadow-nexus-lg backdrop:bg-black/30"
        >
          <div className="flex items-center justify-between gap-3 border-b border-base px-4 py-3">
            <h2 className="font-heading text-sm text-primary">{dictionary.nav.more}</h2>
            <button
              type="button"
              aria-label={dictionary.nav.closeMore}
              onClick={() => setIsMoreOpen(false)}
              className="rounded-md p-1.5 text-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 p-3">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-2 rounded-lg border border-base px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] ${
                    active
                      ? "bg-accent-soft text-accent"
                      : "bg-surface text-secondary hover:bg-hover hover:text-primary"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </dialog>
      )}
    </nav>
  );
}
