"use client";

import { Button } from "@nexus/ui";
import {
  Bell,
  Bookmark,
  BookOpen,
  Code2,
  Compass,
  Home,
  LayoutDashboard,
  Library,
  LifeBuoy,
  LogIn,
  Menu,
  MessageSquare,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { authEntryHref, currentBrowserReturnPath } from "./auth-return-path";
import { communityReportCopy } from "../lib/community-report-copy";
import { reactionCopy } from "../lib/content-reaction-copy";
import { ownDiscussionCopy } from "../lib/discussion-workspace-copy";
import { getDictionary, type Locale } from "../lib/i18n";
import { getOrganizationCopy } from "../lib/organization-workspace-copy";
import { publicationCopy } from "../lib/publication-feed-copy";
import { getUserPlatformCopy } from "../lib/user-platform-copy";
import { verificationCopy } from "../lib/verification-workspace-copy";
import {
  showAdminDestination,
  showGuestSignInCta,
  showWorkspaceTools,
} from "./shell-destination-policy";
import { useAuthSession } from "./use-auth-session";
import { clickedDialogBackdrop, useModalDialog } from "./use-modal-dialog";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Server;
};

export function MobileNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const dictionary = getDictionary(locale);
  const session = useAuthSession();
  const workspaceTools = showWorkspaceTools(session);
  const guestSignIn = showGuestSignInCta(session);
  const adminVisible = showAdminDestination(session);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [loginHref, setLoginHref] = useState(() => authEntryHref("login", pathname));
  const dialogRef = useModalDialog(isMoreOpen);

  useEffect(() => {
    setLoginHref(authEntryHref("login", currentBrowserReturnPath()));
  }, [pathname]);

  const items: NavItem[] = [
    { href: "/", label: dictionary.nav.home, icon: Home },
    { href: "/servers", label: dictionary.nav.liveServers, icon: Server },
    { href: "/market", label: dictionary.nav.mobileMarket, icon: Library },
    {
      href: "/community",
      label: dictionary.nav.community,
      icon: MessageSquare,
    },
  ];

  const publicMoreItems: NavItem[] = [
    { href: "/discover", label: dictionary.nav.explore, icon: Compass },
    { href: "/support", label: dictionary.nav.support, icon: LifeBuoy },
  ];

  const workspaceMoreItems: NavItem[] = [
    {
      href: "/workspace",
      label: dictionary.nav.mobileWorkspace,
      icon: LayoutDashboard,
    },
    { href: "/workspace/saved", label: dictionary.nav.saved, icon: Bookmark },
    { href: "/workspace/content", label: getUserPlatformCopy(locale).studio, icon: BookOpen },
    { href: "/workspace/servers", label: dictionary.nav.liveServers, icon: Server },
    { href: "/workspace/organizations", label: getOrganizationCopy(locale).title, icon: Users },
    { href: "/workspace/feed", label: publicationCopy(locale).title, icon: MessageSquare },
    { href: "/workspace/discussions", label: ownDiscussionCopy(locale).title, icon: MessageSquare },
    { href: "/workspace/reactions", label: reactionCopy(locale).my, icon: MessageSquare },
    { href: "/workspace/reports", label: communityReportCopy(locale).myReports, icon: ShieldAlert },
    { href: "/workspace/verification", label: verificationCopy(locale).title, icon: ShieldCheck },
    { href: "/settings/developer", label: verificationCopy(locale).profile, icon: Code2 },
    {
      href: "/notifications",
      label: dictionary.nav.notifications,
      icon: Bell,
    },
    { href: "/settings", label: dictionary.nav.settings, icon: Settings },
    {
      href: "/security",
      label: dictionary.nav.securityCenter,
      icon: ShieldCheck,
    },
  ];

  const moreItems: NavItem[] = workspaceTools
    ? [...workspaceMoreItems, ...publicMoreItems]
    : publicMoreItems;

  const isActive = (href: string) =>
    href === "/" || href === "/workspace"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  const moreActive =
    pathname === "/workspace" ||
    pathname.startsWith("/workspace/") ||
    moreItems.some((item) => isActive(item.href)) ||
    (guestSignIn && pathname.startsWith("/auth/"));

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

      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsMoreOpen(true)}
        aria-current={moreActive ? "page" : undefined}
        aria-expanded={isMoreOpen}
        aria-haspopup="dialog"
        aria-controls={isMoreOpen ? "mobile-more-menu" : undefined}
        className={`h-auto min-h-12 min-w-0 flex-col gap-1 rounded-md px-1 py-2 text-[10px] font-semibold focus-visible:ring-offset-0 ${
          moreActive ? "bg-accent-soft text-accent" : "text-muted hover:text-primary"
        }`}
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
        <span className="max-w-full truncate">{dictionary.nav.more}</span>
      </Button>

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
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] top-[max(0.75rem,env(safe-area-inset-top))] m-0 ml-auto mr-auto max-h-[min(100%,calc(100dvh-5.5rem-env(safe-area-inset-bottom)-env(safe-area-inset-top)))] w-auto max-w-lg open:flex flex-col overflow-hidden rounded-xl border border-strong bg-elevated p-0 text-primary shadow-nexus-lg backdrop:bg-black/30"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-base px-4 py-3">
            <h2 className="font-heading text-sm text-primary">{dictionary.nav.more}</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={dictionary.nav.closeMore}
              onClick={() => setIsMoreOpen(false)}
              className="h-8 w-8 rounded-md p-1.5 text-muted"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            {/* UX-23 A: guest chrome Sign in only — Workspace cluster stays hidden. */}
            {guestSignIn ? (
              <Link
                href={loginHref}
                onClick={() => setIsMoreOpen(false)}
                className="mb-3 flex min-h-12 items-center gap-2 rounded-lg border border-base bg-surface px-3 py-2 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{dictionary.workspace.signIn}</span>
              </Link>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
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
                    <span className="min-w-0 break-words">{item.label}</span>
                  </Link>
                );
              })}

              {adminVisible && (
                <Link
                  href="/admin"
                  onClick={() => setIsMoreOpen(false)}
                  aria-current={pathname.startsWith("/admin") ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-2 rounded-lg border border-base px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] ${
                    pathname.startsWith("/admin")
                      ? "bg-danger-soft text-danger"
                      : "bg-surface text-secondary hover:bg-hover hover:text-primary"
                  }`}
                >
                  <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{dictionary.nav.admin}</span>
                </Link>
              )}
            </div>
          </div>
        </dialog>
      )}
    </nav>
  );
}
