"use client";

import { BrandMark, Button } from "@nexus/ui";
import { ChevronLeft, ChevronRight, LogIn, type Server, ShieldAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { publicationCopy } from "../../community/publication-feed-copy";
import { getManagedServerCopy } from "../../servers/managed-server-copy";
import { authEntryHref, currentBrowserReturnPath } from "../auth-return";
import { useAuthSession } from "../auth-session";
import {
  adminDestinationAccessibleName,
  isShellSessionLoading,
  shellDestinationActive,
  showAdminDestination,
  showGuestSignInCta,
  showWorkspaceTools,
} from "../session";
import { shellNavigation } from "./shell-navigation";
import { ShellSessionUnavailable } from "./shell-session-unavailable";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Server;
};

export function Sidebar({
  locale,
  isCollapsed,
  onToggle,
  walletEnabled = false,
}: {
  locale: Locale;
  isCollapsed: boolean;
  onToggle: () => void;
  walletEnabled?: boolean;
}) {
  const pathname = usePathname();
  const [loginHref, setLoginHref] = useState(() => authEntryHref("login", pathname));
  const dictionary = getDictionary(locale);

  // biome-ignore lint/correctness/useExhaustiveDependencies(pathname): Refresh login return path after client navigation.
  useEffect(() => {
    setLoginHref(authEntryHref("login", currentBrowserReturnPath()));
  }, [pathname]);
  const serverCopy = getManagedServerCopy(locale);
  const session = useAuthSession();
  const workspaceTools = showWorkspaceTools(session);
  const guestSignIn = showGuestSignInCta(session);
  const sessionLoading = isShellSessionLoading(session);
  const adminVisible = showAdminDestination(session);
  const adminAccessibleName = adminDestinationAccessibleName(
    dictionary.nav.admin,
    dictionary.nav.adminStaffHint,
  );

  const navigation = shellNavigation(locale, { walletEnabled });
  const primaryNav = navigation.primary;
  const libraryNav = navigation.library;
  const serversNav = navigation.servers;
  const publicationsNav = navigation.publications;
  const accountNav: NavItem[] = [
    ...navigation.account,
    ...(process.env.NODE_ENV !== "production"
      ? [{ href: "/dev", label: dictionary.nav.devTools, icon: Wrench }]
      : []),
  ];

  const isActive = (href: string) => shellDestinationActive(href, pathname);

  const renderItems = (items: NavItem[]) =>
    items.map((item) => {
      const Icon = item.icon;
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          title={isCollapsed ? item.label : undefined}
          aria-label={isCollapsed ? item.label : undefined}
          aria-current={active ? "page" : undefined}
          className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--nexus-accent)] ${
            active
              ? "bg-accent-soft font-semibold text-accent"
              : "text-secondary hover:bg-hover hover:text-primary"
          } ${isCollapsed ? "justify-center px-0" : ""}`}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!isCollapsed && <span>{item.label}</span>}
        </Link>
      );
    });

  const renderGroup = (label: string, items: NavItem[], bordered = true) => (
    <div className={`space-y-0.5 ${bordered ? "border-t border-base pt-3" : ""}`}>
      {!isCollapsed && <div className="px-2.5 pb-1.5 font-label uppercase text-faint">{label}</div>}
      {renderItems(items)}
    </div>
  );

  return (
    <aside
      className={`sticky top-0 z-30 hidden h-dvh max-h-dvh shrink-0 select-none flex-col self-start border-r border-base bg-surface transition-all duration-200 lg:flex ${
        isCollapsed ? "w-14" : "w-56"
      }`}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-base px-3">
        {isCollapsed ? (
          <BrandMark href="/" showWordmark={false} className="mx-auto rounded-lg" />
        ) : (
          <>
            <div className="flex min-w-0 flex-col">
              <BrandMark href="/" className="min-w-0" />
              <span className="ml-10 font-caption leading-tight text-faint">
                {dictionary.nav.openFreeBeta}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-8 w-8 shrink-0 rounded-md p-1 text-muted"
              aria-label={dictionary.nav.collapse}
              title={dictionary.nav.collapse}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          </>
        )}
      </div>

      <nav
        className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-2 py-3"
        aria-label={dictionary.nav.ecosystem}
      >
        <div className="space-y-0.5">
          {!isCollapsed && (
            <div className="px-2.5 pb-1.5 font-label uppercase text-faint">
              {dictionary.nav.ecosystem}
            </div>
          )}
          {renderItems(primaryNav)}
        </div>

        {workspaceTools ? (
          <>
            {renderGroup(dictionary.nav.workspace, libraryNav)}
            {renderGroup(serverCopy.title, serversNav)}
            {renderGroup(publicationCopy(locale).title, publicationsNav)}
            {renderGroup(dictionary.nav.settings, accountNav)}
          </>
        ) : null}

        {/* UX-23 A: guest chrome Sign in only — no Workspace cluster. */}
        {guestSignIn ? (
          <div className="space-y-0.5 border-t border-base pt-3">
            <Link
              href={loginHref}
              title={isCollapsed ? dictionary.workspace.signIn : undefined}
              aria-label={isCollapsed ? dictionary.workspace.signIn : undefined}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--nexus-accent)] ${
                isCollapsed ? "justify-center px-0" : ""
              }`}
            >
              <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!isCollapsed && <span className="font-semibold">{dictionary.workspace.signIn}</span>}
            </Link>
          </div>
        ) : null}

        {sessionLoading ? (
          <div className="space-y-0.5 border-t border-base pt-3" aria-busy="true">
            <p role="status" className={isCollapsed ? "sr-only" : "px-2.5 text-xs text-muted"}>
              {dictionary.nav.checkingSession}
            </p>
          </div>
        ) : null}

        {session.status === "unavailable" ? (
          <div className="border-t border-base pt-3">
            <ShellSessionUnavailable locale={locale} retry={session.retry} compact={isCollapsed} />
          </div>
        ) : null}

        {adminVisible && (
          <div className="space-y-0.5 border-t border-base pt-3">
            <Link
              href="/admin"
              title={dictionary.nav.adminStaffHint}
              aria-label={adminAccessibleName}
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--nexus-accent)] ${
                pathname.startsWith("/admin")
                  ? "bg-danger-soft font-semibold text-danger"
                  : "text-secondary hover:bg-hover hover:text-primary"
              } ${isCollapsed ? "justify-center px-0" : ""}`}
            >
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!isCollapsed && <span>{dictionary.nav.admin}</span>}
            </Link>
          </div>
        )}
      </nav>

      {isCollapsed && (
        <div className="border-t border-base p-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-full justify-center rounded-md p-1.5 text-muted"
            aria-label={dictionary.nav.expand}
            title={dictionary.nav.expand}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </aside>
  );
}
