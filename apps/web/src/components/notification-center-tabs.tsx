"use client";

import { nextTabIndex } from "@nexus/ui";
import { useId, useState, type ReactNode } from "react";
import { useNexusLocale } from "./locale-context";

export function NotificationCenterTabs({ children }: { children: ReactNode }) {
  const { dictionary } = useNexusLocale();
  const copy = dictionary.notifications;
  const tabIdPrefix = useId();
  const panelId = useId();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const items = ["all", "unread"] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={copy.title}>
        {items.map((item, index) => {
          const active = filter === item;
          const tabId = `${tabIdPrefix}-${item}`;
          return (
            <button
              key={item}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              onClick={() => setFilter(item)}
              onKeyDown={(event) => {
                const nextIndex = nextTabIndex(items.length, index, event.key);
                if (nextIndex === null) return;
                const next = items[nextIndex];
                if (!next) return;
                event.preventDefault();
                setFilter(next);
                event.currentTarget.parentElement
                  ?.querySelectorAll<HTMLElement>('[role="tab"]')
                  [nextIndex]?.focus();
              }}
              className={`min-h-11 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] ${
                active
                  ? "border-[color:var(--nexus-accent)] bg-accent text-white"
                  : "border-base bg-surface text-muted hover:bg-hover hover:text-primary"
              }`}
            >
              {item === "all" ? copy.all : copy.unread}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={`${tabIdPrefix}-${filter}`}>
        {children}
      </div>
    </div>
  );
}
