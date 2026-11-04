"use client";

import type { Notification } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { Bell, CheckCheck, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatNotification } from "../lib/notification-copy";
import { notificationInboxCopy } from "../lib/notification-inbox-copy";
import {
  announceNotificationInboxChange,
  observeNotificationInboxChange,
} from "../lib/notification-inbox-events";
import { privateApiRequest } from "../lib/private-api-request";
import { startVisiblePolling } from "../lib/visible-polling";
import { confirmAction } from "./confirm-action";
import { useNexusLocale } from "./locale-context";
import { clickedDialogBackdrop, useModalDialog } from "./use-modal-dialog";

export function NotificationBell() {
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.notificationBell;
  const inboxCopy = notificationInboxCopy(locale);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dialogRef = useModalDialog(isOpen);
  const mutationGeneration = useRef(0);
  const stopPolling = useRef<(() => void) | null>(null);
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";

  useEffect(() => observeNotificationInboxChange(() => setAttempt((value) => value + 1)), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies(attempt): Explicit refresh trigger; changing it must restart this request.
  useEffect(() => {
    if (marking) return;
    const generation = mutationGeneration.current;
    const stop = startVisiblePolling({
      async read(signal) {
        const response = await fetch("/api/notifications?limit=6", privateApiRequest({ signal }));
        const data = await response.json().catch(() => null);
        if (
          !response.ok ||
          !Array.isArray(data?.notifications) ||
          !Number.isSafeInteger(data?.unreadCount) ||
          data.unreadCount < 0
        ) {
          throw new Error(copy.loadError);
        }

        return data;
      },
      onValue(data) {
        if (generation === mutationGeneration.current) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
          setLoaded(true);
          setError(null);
        }
      },
      onError() {
        if (generation === mutationGeneration.current) setError(copy.loadError);
      },
    });
    stopPolling.current = stop;

    return () => {
      stop();
      if (stopPolling.current === stop) stopPolling.current = null;
    };
  }, [attempt, copy.loadError, marking]);

  async function markAllRead() {
    if (marking || !loaded || unreadCount === 0) return;
    if (
      !(await confirmAction({
        title: inboxCopy.markAllRead,
        object: inboxCopy.title,
        scope: String(unreadCount),
        consequences: inboxCopy.allConfirm,
        confirmLabel: inboxCopy.markAllRead,
        cancelLabel: inboxCopy.reset,
        closeLabel: inboxCopy.reset,
        danger: false,
      }))
    )
      return;

    mutationGeneration.current += 1;
    stopPolling.current?.();
    setMarking(true);
    setError(null);
    setAnnouncement(null);
    try {
      const response = await fetch(
        "/api/notifications/mark-read",
        privateApiRequest({ method: "POST" }),
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true || data?.scope !== "all") {
        throw new Error(copy.markError);
      }

      // Read the server state again; a notification may arrive during this request.
      // Do not zero local counters until the next confirmed poll.
      setAnnouncement(copy.markedAllRead);
      announceNotificationInboxChange();
    } catch {
      // Recheck the server after an ambiguous response or timeout; keep last confirmed counts.
      setAttempt((value) => value + 1);
      setError(copy.markError);
    } finally {
      setMarking(false);
    }
  }

  const confirmedUnread = loaded ? unreadCount : null;
  const bellLabel =
    confirmedUnread !== null && confirmedUnread > 0
      ? `${confirmedUnread} ${copy.unreadSuffix}`
      : copy.title;

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => {
          // Opening the popover refreshes the preview; it does not mark notifications read.
          if (!isOpen) setAttempt((value) => value + 1);
          setIsOpen((open) => !open);
        }}
        className="relative h-8 w-8 shrink-0 rounded-md border-base bg-elevated p-0 text-secondary"
        aria-label={bellLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={isOpen ? "notification-popover" : undefined}
        aria-busy={(!loaded && !error) || marking || undefined}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {confirmedUnread !== null && confirmedUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-numeric text-[10px] font-bold text-white">
            {confirmedUnread}
          </span>
        )}
        {error && (confirmedUnread === null || confirmedUnread === 0) && (
          <span
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--nexus-warning)]"
            aria-hidden="true"
          />
        )}
      </Button>

      {announcement && (
        <span role="status" aria-live="polite" className="sr-only">
          {announcement}
        </span>
      )}

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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={copy.close}
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 min-h-6 min-w-6 rounded-md p-1 text-muted"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
            {confirmedUnread !== null && confirmedUnread > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={marking}
                onClick={() => void markAllRead()}
                className="h-auto min-h-11 gap-1 px-1 text-[11px] font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                <CheckCheck className="h-3 w-3" aria-hidden="true" />
                <span>{inboxCopy.markAllRead}</span>
              </Button>
            )}
          </div>

          {error ? (
            <ErrorState
              title={error}
              description={copy.errorHint}
              className="rounded-none border-x-0 border-t-0 py-4"
              action={
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setError(null);
                    setAttempt((value) => value + 1);
                  }}
                  className="h-auto min-h-11 px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                >
                  {copy.retry}
                </Button>
              }
            />
          ) : null}

          <section
            aria-label={copy.previewList}
            aria-busy={!loaded && !error}
            className="min-h-0 max-h-80 divide-y divide-[color:var(--nexus-border)] overflow-y-auto"
          >
            {!loaded && !error ? (
              <div role="status" className="py-6 text-center font-caption text-muted">
                {copy.loading}
              </div>
            ) : !loaded ? null : notifications.length > 0 ? (
              notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`space-y-1 p-3 ${
                    notification.isRead ? "hover:bg-hover" : "bg-accent-soft"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-primary">
                      {
                        formatNotification(
                          notification,
                          dictionary.buildReviewNotifications,
                          locale,
                        ).title
                      }
                    </span>
                    <time
                      dateTime={new Date(notification.createdAt).toISOString()}
                      className="shrink-0 font-caption text-faint"
                    >
                      {new Date(notification.createdAt).toLocaleDateString(dateLocale)}
                    </time>
                  </div>
                  <p className="line-clamp-2 whitespace-pre-wrap break-words font-caption text-muted">
                    {
                      formatNotification(notification, dictionary.buildReviewNotifications, locale)
                        .message
                    }
                  </p>
                  {notification.link && (
                    // Destination navigation alone does not change isRead; use Mark all read or the center.
                    <Link
                      href={notification.link}
                      onClick={() => setIsOpen(false)}
                      className="inline-flex min-h-11 items-center gap-1 text-[11px] text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                    >
                      <span>{copy.view}</span>
                      <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                    </Link>
                  )}
                </article>
              ))
            ) : (
              <EmptyState
                title={copy.empty}
                description={copy.emptyHint}
                icon={<Bell className="h-6 w-6" aria-hidden="true" />}
                className="rounded-none border-x-0 border-y-0 py-6"
              />
            )}
          </section>

          <div className="space-y-1.5 border-t border-base px-3 py-2 text-center">
            <p className="font-caption text-faint">{copy.previewFootnote}</p>
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-flex min-h-11 items-center font-caption text-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.openCenter} →
            </Link>
          </div>
        </dialog>
      )}
    </div>
  );
}
