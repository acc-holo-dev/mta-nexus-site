"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  ExternalLink,
  Settings,
} from "lucide-react";
import {
  Button,
  EmptyState,
  Skeleton,
  nextTabIndex,
} from "@nexus/ui";
import { formatNotification } from "../../lib/notification-copy";
import type { Notification } from "@nexus/domain";
import { useNexusLocale } from "../../components/locale-context";

const LOADING_CARD_IDS = ["first", "second", "third", "fourth"] as const;

export default function NotificationCenterPage() {
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.notifications;
  const tabIdPrefix = useId();
  const resultsPanelId = useId();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const requestGeneration = useRef(0);

  const loadNotifications = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const query =
        filter === "unread"
          ? "?limit=100&unreadOnly=true"
          : "?limit=100";
      const response = await fetch(`/api/notifications${query}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json().catch(() => null);
      if (
        !response.ok ||
        !Array.isArray(data?.notifications) ||
        !Number.isSafeInteger(data?.unreadCount) ||
        data.unreadCount < 0
      ) {
        throw new Error(data?.error || copy.loadError);
      }
      if (generation === requestGeneration.current) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (caught) {
      if (generation !== requestGeneration.current) return;
      setNotifications([]);
      setUnreadCount(0);
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : copy.loadError,
      );
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [filter, copy.loadError]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  async function markAllRead() {
    if (marking) return;
    requestGeneration.current += 1;
    setMarking(true);
    setError(null);
    setAnnouncement(null);
    try {
      const response = await fetch("/api/notifications/mark-read", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true || data?.scope !== "all") {
        throw new Error(data?.error || copy.markError);
      }
      // Confirm the state from the server, including notifications added concurrently.
      await loadNotifications();
      setAnnouncement(copy.markedAllRead);
    } catch (caught) {
      // The write might have succeeded even if its response was lost.
      await loadNotifications();
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : copy.markError,
      );
    } finally {
      setMarking(false);
    }
  }

  const filtered =
    filter === "unread"
      ? notifications.filter((notification) => !notification.isRead)
      : notifications;
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="flex flex-col justify-between gap-4 border-b border-base pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-muted">
            <Link
              href="/workspace"
              className="flex items-center gap-1 transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              <span>{copy.workspace}</span>
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-secondary">{dictionary.nav.notifications}</span>
          </div>
          <h1 className="flex items-center gap-2.5 font-display text-primary">
            <Bell className="h-6 w-6 text-accent" aria-hidden="true" />
            <span>{copy.title}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">{copy.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-base bg-surface px-3.5 py-2 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span>{copy.settings}</span>
          </Link>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={marking}
              onClick={() => void markAllRead()}
            >
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              <span>{copy.markAllRead}</span>
            </Button>
          )}
        </div>
      </header>

      <div
        className="flex items-center gap-2"
        role="tablist"
        aria-label={copy.title}
      >
        {(["all", "unread"] as const).map((item, index, items) => {
          const active = filter === item;
          const tabId = `${tabIdPrefix}-${item}`;

          return (
            <button
              key={item}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={resultsPanelId}
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
              className={`min-h-8 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] ${
                active
                  ? "border-[color:var(--nexus-accent)] bg-accent text-white"
                  : "border-base bg-surface text-muted hover:bg-hover hover:text-primary"
              }`}
            >
              {item === "all" ? copy.all : `${copy.unread} (${unreadCount})`}
            </button>
          );
        })}
      </div>

      {announcement && (
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--nexus-danger)]/25 bg-danger-soft p-4 text-sm text-danger"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadNotifications()}
            className="min-h-6 shrink-0 rounded-sm px-1 font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-danger)]"
          >
            {dictionary.errors.retry}
          </button>
        </div>
      )}

      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: A tabpanel must be keyboard-focusable when its content has no focusable target. */}
      <div tabIndex={0}
        id={resultsPanelId}
        role="tabpanel"
        aria-labelledby={`${tabIdPrefix}-${filter}`}
        className="space-y-3"
      >
        {loading ? (
          LOADING_CARD_IDS.map((id) => (
            <div key={id} className="nexus-panel space-y-3 p-4">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          ))
        ) : filtered.length > 0 ? (
          filtered.map((notification) => (
            <article
              key={notification.id}
              className={`rounded-xl border p-4 transition-colors ${
                !notification.isRead
                  ? "border-[color:var(--nexus-accent)]/25 bg-accent-soft"
                  : "border-base bg-surface"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-words text-sm font-bold text-primary">
                      {formatNotification(notification, dictionary.buildReviewNotifications, locale).title}
                    </h2>
                    <span className="rounded border border-base bg-inset px-2 py-0.5 font-numeric text-[10px] uppercase text-muted">
                      {notification.type}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-secondary">
                    {formatNotification(notification, dictionary.buildReviewNotifications, locale).message}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <time
                    dateTime={new Date(notification.createdAt).toISOString()}
                    className="font-numeric text-[11px] text-faint"
                  >
                    {new Date(notification.createdAt).toLocaleDateString(
                      dateLocale,
                    )}
                  </time>
                  {notification.link && (
                    <Link
                      href={notification.link}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                    >
                      <span>{copy.view}</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            title={copy.empty}
            description={copy.description}
            icon={<Bell className="h-6 w-6" aria-hidden="true" />}
          />
        )}
      </div>
    </div>
  );
}
