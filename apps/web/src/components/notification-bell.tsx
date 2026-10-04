"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CheckCheck, ExternalLink, X } from "lucide-react";
import { clickedDialogBackdrop, useModalDialog } from "./use-modal-dialog";
import { formatNotification } from "../lib/notification-copy";
import type { Notification } from "@nexus/domain";
import { useNexusLocale } from "./locale-context";

export function NotificationBell() {
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.notificationBell;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dialogRef = useModalDialog(isOpen);
  const mutationGeneration = useRef(0);
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";

  // biome-ignore lint/correctness/useExhaustiveDependencies(attempt): Explicit refresh trigger; changing it must restart this request.
  useEffect(() => {
    let active = true;

    async function fetchNotifications() {
      const generation = mutationGeneration.current;
      try {
        const response = await fetch("/api/notifications?limit=6", {
          cache: "no-store",
          credentials: "same-origin",
          signal: AbortSignal.timeout(10_000),
        });
        const data = await response.json().catch(() => null);
        if (
          !response.ok ||
          !Array.isArray(data?.notifications) ||
          !Number.isSafeInteger(data?.unreadCount) ||
          data.unreadCount < 0
        ) {
          throw new Error(copy.loadError);
        }

        if (active && generation === mutationGeneration.current) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
          setError(null);
        }
      } catch {
        if (active && generation === mutationGeneration.current) setError(copy.loadError);
      }
    }

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void fetchNotifications();
    };
    refreshIfVisible();
    document.addEventListener("visibilitychange", refreshIfVisible);
    const interval = window.setInterval(refreshIfVisible, 30_000);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.clearInterval(interval);
    };
  }, [attempt, copy.loadError]);

  async function markAllRead() {
    if (marking || unreadCount === 0) return;

    mutationGeneration.current += 1;
    setMarking(true);
    setError(null);
    try {
      const response = await fetch("/api/notifications/mark-read", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true || data?.scope !== "all") {
        throw new Error(copy.markError);
      }

      // Read the server state again; a notification may arrive during this request.
      setAttempt((value) => value + 1);
    } catch {
      // Recheck the server after an ambiguous response or timeout.
      setAttempt((value) => value + 1);
      setError(copy.markError);
    } finally {
      setMarking(false);
    }
  }

  const bellLabel = unreadCount > 0 ? `${unreadCount} ${copy.unreadSuffix}` : copy.title;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (!isOpen) setAttempt((value) => value + 1);
          setIsOpen((open) => !open);
        }}
        className="relative inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-base bg-elevated p-0 text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        aria-label={bellLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls="notification-popover"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-numeric text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
        {error && unreadCount === 0 && (
          <span
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--nexus-warning)]"
            aria-hidden="true"
          />
        )}
      </button>

      {isOpen && (
        <dialog
          ref={dialogRef}
          id="notification-popover"
          aria-modal="true"
          aria-label={copy.title}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setIsOpen(false);
            }
          }}
          onCancel={(event) => {
            event.preventDefault();
            setIsOpen(false);
          }}
          onClick={(event) => {
            if (clickedDialogBackdrop(event)) setIsOpen(false);
          }}
          className="fixed right-4 top-20 bottom-auto left-auto m-0 open:flex max-h-[calc(100dvh-6rem)] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-strong bg-elevated p-0 text-primary shadow-nexus-lg backdrop:bg-black/30 sm:top-16"
        >
          <div className="flex items-center justify-between gap-3 border-b border-base px-3 py-2.5">
            <span className="font-heading text-xs text-primary">{copy.title}</span>
            <button
              type="button"
              aria-label={copy.close}
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={marking}
                onClick={() => void markAllRead()}
                className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline disabled:opacity-50"
              >
                <CheckCheck className="h-3 w-3" aria-hidden="true" />
                <span>{copy.markAllRead}</span>
              </button>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 border-b border-base bg-warning-soft px-3 py-2 text-[11px] text-warning"
            >
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {error}
              </span>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="font-semibold underline"
              >
                {copy.retry}
              </button>
            </div>
          )}

          <div className="min-h-0 max-h-80 divide-y divide-[color:var(--nexus-border)] overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`space-y-1 p-3 ${
                    notification.isRead ? "hover:bg-hover" : "bg-accent-soft"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-primary">
                      {formatNotification(notification, dictionary.buildReviewNotifications).title}
                    </span>
                    <time
                      dateTime={new Date(notification.createdAt).toISOString()}
                      className="shrink-0 font-caption text-faint"
                    >
                      {new Date(notification.createdAt).toLocaleDateString(dateLocale)}
                    </time>
                  </div>
                  <p className="line-clamp-2 whitespace-pre-wrap break-words font-caption text-muted">
                    {formatNotification(notification, dictionary.buildReviewNotifications).message}
                  </p>
                  {notification.link && (
                    <Link
                      href={notification.link}
                      onClick={() => setIsOpen(false)}
                      className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                    >
                      <span>{copy.view}</span>
                      <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                    </Link>
                  )}
                </article>
              ))
            ) : (
              <div className="py-6 text-center font-caption text-muted">{copy.empty}</div>
            )}
          </div>

          <div className="border-t border-base px-3 py-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="font-caption text-muted transition-colors hover:text-primary"
            >
              {copy.openCenter} →
            </Link>
          </div>
        </dialog>
      )}
    </div>
  );
}
