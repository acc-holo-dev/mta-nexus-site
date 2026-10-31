"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getServerWorkspaceNavCopy } from "../lib/server-workspace-nav-i18n";
import type { Locale } from "../lib/i18n";

type NavItem = {
  key: "overview" | "content" | "activity" | "statistics" | "observations";
  href: string;
  match: "exact" | "prefix";
};

function items(serverId: string): NavItem[] {
  const base = `/workspace/servers/${encodeURIComponent(serverId)}`;
  return [
    { key: "overview", href: base, match: "exact" },
    { key: "content", href: `${base}/content`, match: "prefix" },
    { key: "activity", href: `${base}/activity`, match: "prefix" },
    { key: "statistics", href: `${base}/statistics`, match: "prefix" },
    { key: "observations", href: `${base}/observations`, match: "prefix" },
  ];
}

function isCurrent(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ServerWorkspaceNav({
  serverId,
  locale = "en",
}: {
  serverId: string;
  locale?: Locale;
}) {
  const pathname = usePathname() || "";
  const copy = getServerWorkspaceNavCopy(locale);

  return (
    <nav
      aria-label={copy.navigation}
      className="rounded-lg border border-base bg-surface p-4"
    >
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {items(serverId).map((item) => {
          const current = isCurrent(pathname, item);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={
                  current
                    ? "font-semibold text-primary underline decoration-accent underline-offset-4"
                    : "text-accent underline underline-offset-2 hover:text-primary"
                }
              >
                {copy[item.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
