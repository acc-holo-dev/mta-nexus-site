import Link from "next/link";
import type { ReactNode } from "react";
import {
  type NotificationInboxQuery,
  notificationInboxHref,
} from "../lib/notification-inbox-contract";

const STATES = ["all", "unread", "read"] as const;

const filterLinkFocusClass =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
const activeTabFocusClass =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export function NotificationCenterTabs({
  children,
  state = "all",
  filters = null,
  labels,
}: {
  children: ReactNode;
  state?: (typeof STATES)[number];
  filters?: NotificationInboxQuery | null;
  labels: { title: string; all: string; unread: string; read: string };
}) {
  const base: NotificationInboxQuery = filters
    ? {
        query: filters.query,
        state: filters.state,
        category: filters.category,
        period: filters.period,
        at: filters.at,
      }
    : { query: "", state: "all", category: "all" };

  return (
    <div className="space-y-4">
      <nav aria-label={labels.title} className="flex flex-wrap items-center gap-2">
        {STATES.map((item) => {
          const active = state === item;
          const href = notificationInboxHref("/notifications", { ...base, state: item });
          return (
            <Link
              key={item}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-lg px-3 py-1.5 text-xs font-semibold ${
                active ? activeTabFocusClass : filterLinkFocusClass
              } ${active ? "bg-accent text-white" : "border border-base text-muted"}`}
            >
              {labels[item]}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
