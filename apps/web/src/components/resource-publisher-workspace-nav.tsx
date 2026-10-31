"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getResourcePublisherNavCopy,
  type ResourcePublisherNavCopy,
} from "../lib/resource-publisher-nav-i18n";
import type { Locale } from "../lib/i18n";

type NavItem = {
  key: keyof ResourcePublisherNavCopy;
  href: string;
  match: "exact" | "prefix";
};

type NavGroup = {
  labelKey: keyof ResourcePublisherNavCopy;
  items: NavItem[];
};

function groups(resourceId: string, organizationId?: string | null): NavGroup[] {
  const base = `/workspace/resources/${encodeURIComponent(resourceId)}`;
  const salesQuery = new URLSearchParams({
    productId: resourceId,
    ...(organizationId ? { organizationId } : {}),
  });
  return [
    {
      labelKey: "overview",
      items: [{ key: "overview", href: base, match: "exact" }],
    },
    {
      labelKey: "groupCard",
      items: [
        { key: "media", href: `${base}/media`, match: "prefix" },
        { key: "variants", href: `${base}/variants`, match: "prefix" },
        { key: "compatibility", href: `${base}/compatibility`, match: "prefix" },
        { key: "duplicate", href: `${base}/copy`, match: "exact" },
        { key: "copyHistory", href: `${base}/copies`, match: "prefix" },
      ],
    },
    {
      labelKey: "groupVersions",
      items: [
        { key: "activity", href: `${base}/activity`, match: "prefix" },
        { key: "moderation", href: `${base}/moderation`, match: "prefix" },
        { key: "changes", href: `${base}/history`, match: "prefix" },
      ],
    },
    {
      labelKey: "groupCommerce",
      items: [
        {
          key: "sales",
          href: `/workspace/sales/report?${salesQuery}`,
          match: "prefix",
        },
        { key: "deliveries", href: `${base}/deliveries`, match: "prefix" },
      ],
    },
  ];
}

function isCurrent(pathname: string, item: NavItem): boolean {
  const hrefPath = item.href.split("?")[0] ?? item.href;
  if (item.match === "exact") return pathname === hrefPath;
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

export function ResourcePublisherWorkspaceNav({
  resourceId,
  organizationId,
  locale = "en",
}: {
  resourceId: string;
  organizationId?: string | null;
  locale?: Locale;
}) {
  const pathname = usePathname() || "";
  const copy = getResourcePublisherNavCopy(locale);
  const sections = groups(resourceId, organizationId);

  return (
    <nav aria-label={copy.navigation} className="space-y-4 rounded-lg border border-base bg-surface p-4">
      {sections.map((section) => (
        <div key={section.labelKey} className="space-y-2">
          <p className="font-label text-[10px] uppercase tracking-wide text-faint">
            {copy[section.labelKey]}
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {section.items.map((item) => {
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
        </div>
      ))}
    </nav>
  );
}
