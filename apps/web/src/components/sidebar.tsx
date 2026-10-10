"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Code2,
  Compass,
  LayoutDashboard,
  Library,
  MessageSquare,
  Plus,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  Users,
} from "lucide-react";
import { getDictionary, type Locale } from "../lib/i18n";
import { getManagedServerCopy } from "../lib/managed-server-view";
import { getOrganizationCopy } from "../lib/organization-workspace-copy";
import { getUserPlatformCopy } from "../lib/user-platform-copy";
import { publicationCopy } from "../lib/publication-feed-copy";
import { communityReportCopy } from "../lib/community-report-copy";

export function Sidebar({
  locale,
  isCollapsed,
  onToggle,
}: {
  locale: Locale;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const dictionary = getDictionary(locale);
  const serverCopy = getManagedServerCopy(locale);

  const primaryNav = [
    { href: "/servers", label: dictionary.nav.liveServers, icon: Server },
    { href: "/discover", label: dictionary.nav.explore, icon: Compass },
    { href: "/market", label: dictionary.nav.freeResources, icon: Library },
    { href: "/community", label: dictionary.nav.community, icon: MessageSquare },
    { href: "/articles", label: dictionary.nav.updates, icon: BookOpen },
    { href: "/developers", label: dictionary.nav.creators, icon: Code2 },
  ];

  const workspaceNav = [
    { href: "/workspace/reports", label: communityReportCopy(locale).myReports, icon: ShieldAlert },
    { href: "/workspace/feed", label: publicationCopy(locale).title, icon: MessageSquare },
    { href: "/workspace", label: dictionary.nav.overview, icon: LayoutDashboard },
    { href: "/workspace/organizations", label: getOrganizationCopy(locale).title, icon: Users },
    { href: "/workspace/content", label: getUserPlatformCopy(locale).studio, icon: BookOpen },
    { href: "/workspace/resources/new", label: dictionary.nav.publishResource, icon: Plus },
    { href: "/workspace/servers", label: serverCopy.title, icon: Server },
    { href: "/workspace/servers/new", label: dictionary.nav.registerServer, icon: Server },
    { href: "/workspace/saved", label: dictionary.nav.saved, icon: Bookmark },
    { href: "/notifications", label: dictionary.nav.notifications, icon: Bell },
    { href: "/security", label: dictionary.nav.securityCenter, icon: ShieldCheck },
    { href: "/settings", label: dictionary.nav.settings, icon: Settings },
    ...(process.env.NODE_ENV !== "production"
      ? [{ href: "/dev", label: dictionary.nav.devTools, icon: Wrench }]
      : []),
  ];

  const isActive = (href: string) =>
    href === "/workspace"
      ? pathname === "/workspace"
      : href === "/workspace/servers"
        ? pathname === href || (pathname.startsWith(`${href}/`) && pathname !== `${href}/new`)
        : pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  const renderItems = (
    items: Array<{
      href: string;
      label: string;
      icon: typeof Server;
    }>,
  ) =>
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

  return (
    <aside
      className={`z-30 hidden shrink-0 select-none flex-col border-r border-base bg-surface transition-all duration-200 lg:flex ${
        isCollapsed ? "w-14" : "w-56"
      }`}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-base px-3">
        {isCollapsed ? (
          <Link
            href="/"
            className="mx-auto rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            aria-label="MTA Nexus"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-xs font-black text-white shadow-nexus-sm">
              NX
            </div>
          </Link>
        ) : (
          <>
            <Link
              href="/"
              className="flex min-w-0 items-center space-x-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-black text-white shadow-nexus-sm">
                NX
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="font-heading leading-tight text-primary">
                  MTA <span className="text-accent">NEXUS</span>
                </span>
                <span className="font-caption leading-tight text-faint">
                  {dictionary.nav.closedBeta}
                </span>
              </div>
            </Link>
            <button
              type="button"
              onClick={onToggle}
              className="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              aria-label={dictionary.nav.collapse}
              title={dictionary.nav.collapse}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <nav
        className="flex-1 space-y-5 overflow-y-auto px-2 py-3"
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

        <div className="space-y-0.5 border-t border-base pt-3">
          {!isCollapsed && (
            <div className="px-2.5 pb-1.5 font-label uppercase text-faint">
              {dictionary.nav.workspace}
            </div>
          )}
          {renderItems(workspaceNav)}
        </div>

        <div className="space-y-0.5 border-t border-base pt-3">
          <Link
            href="/admin"
            title={isCollapsed ? dictionary.nav.admin : undefined}
            aria-label={isCollapsed ? dictionary.nav.admin : undefined}
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
      </nav>

      {isCollapsed && (
        <div className="border-t border-base p-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full justify-center rounded-md p-1.5 text-muted transition-colors hover:bg-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            aria-label={dictionary.nav.expand}
            title={dictionary.nav.expand}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </aside>
  );
}
