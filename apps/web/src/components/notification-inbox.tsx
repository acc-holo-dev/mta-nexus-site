"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  confirmedNotificationInboxCommand,
  type NotificationInboxPage,
  type NotificationInboxQuery,
  notificationInboxHref,
  notificationInboxPageSchema,
} from "../lib/notification-inbox-contract";
import { notificationInboxCopy, notificationInboxError } from "../lib/notification-inbox-copy";
import { announceNotificationInboxChange } from "../lib/notification-inbox-events";
import { useNexusLocale } from "./locale-context";
export function NotificationInbox({
  initialPage,
  filters,
}: {
  initialPage: NotificationInboxPage;
  filters: NotificationInboxQuery;
}) {
  const { locale } = useNexusLocale(),
    copy = notificationInboxCopy(locale);
  const [page, setPage] = useState(initialPage),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState(""),
    [announcement, setAnnouncement] = useState("");
  const pending = useRef(false),
    controller = useRef<AbortController | null>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  const readHref = notificationInboxHref(
    "/api/notifications/inbox",
    filters,
    filters.cursor ? JSON.stringify(filters.cursor) : undefined,
  );
  async function read(signal: AbortSignal) {
    const response = await fetch(readHref, {
      cache: "no-store",
      credentials: "same-origin",
      signal,
    });
    const data = await response.json().catch(() => null),
      parsed = notificationInboxPageSchema.safeParse(data);
    if (!response.ok || !parsed.success)
      throw new Error(notificationInboxError(locale, data?.code));
    return parsed.data;
  }
  async function refresh() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setAnnouncement("");
    const active = new AbortController();
    controller.current = active;
    try {
      const saved = await read(AbortSignal.any([active.signal, AbortSignal.timeout(15000)]));
      if (!mounted.current) return;
      setPage(saved);
      setSelected([]);
      setBlocked(false);
    } catch (failure) {
      if (mounted.current) {
        const message = failure instanceof Error ? failure.message : "";
        setError(Object.values(copy).includes(message) ? message : copy.unavailable);
        setBlocked(true);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function mark(isRead: boolean, ids = selected, entireInbox = false) {
    if (pending.current || blocked || (!entireInbox && !ids.length)) return;
    if (entireInbox && (!page.unreadCount || !window.confirm(copy.allConfirm))) return;
    const items = page.items
      .filter((item) => ids.includes(item.id))
      .map((item) => ({ id: item.id, expectedIsRead: item.isRead }));
    if (items.length !== ids.length) return;
    const command = { isRead, items };
    pending.current = true;
    setBusy(true);
    setError("");
    setAnnouncement("");
    setBlocked(true);
    const active = new AbortController();
    controller.current = active;
    const signal = AbortSignal.any([active.signal, AbortSignal.timeout(15000)]);
    let confirmed = false;
    try {
      const response = await fetch(
        entireInbox ? "/api/notifications/mark-read" : "/api/notifications/inbox",
        {
          method: entireInbox ? "POST" : "PATCH",
          cache: "no-store",
          credentials: "same-origin",
          signal,
          ...(entireInbox
            ? {}
            : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) }),
        },
      );
      const data = await response.json().catch(() => null);
      if (!mounted.current) return;
      signal.throwIfAborted();
      if (!response.ok) throw new Error(notificationInboxError(locale, data?.code));
      if (
        entireInbox
          ? data?.success !== true || data?.scope !== "all"
          : !confirmedNotificationInboxCommand(data, command)
      )
        throw new Error(copy.uncertain);
      confirmed = true;
      announceNotificationInboxChange();
      const saved = await read(signal);
      if (!mounted.current) return;
      setPage(saved);
      setSelected([]);
      setBlocked(false);
      setAnnouncement(copy.saved);
    } catch (failure) {
      if (mounted.current) {
        setSelected([]);
        const message = failure instanceof Error ? failure.message : "";
        setError(
          !confirmed && Object.values(copy).includes(message) && message !== copy.uncertain
            ? `${message} ${copy.uncertain}`
            : copy.uncertain,
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const disabled = busy || blocked;
  return (
    <section className="space-y-4" aria-busy={busy} aria-label={copy.title}>
      <p className="text-sm text-muted">
        {copy.totalUnread}: <strong className="text-primary">{page.unreadCount}</strong>
      </p>
      <p className="text-xs text-muted">{copy.live}</p>
      {busy && (
        <p role="status" className="text-sm text-muted">
          {copy.loading}
        </p>
      )}
      {announcement && (
        <p role="status" className="nexus-panel p-4 text-sm text-success">
          {announcement}
        </p>
      )}
      {error && (
        <p role="alert" className="nexus-panel p-4 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="nexus-panel flex flex-wrap items-center gap-3 p-4">
        {page.unreadCount > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void mark(true, [], true)}
            className="min-h-11 rounded-lg border border-base px-3 text-sm text-accent disabled:opacity-50"
          >
            {copy.markAllRead}
          </button>
        )}
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            checked={page.items.length > 0 && selected.length === page.items.length}
            disabled={disabled || !page.items.length}
            onChange={(event) =>
              setSelected(event.target.checked ? page.items.map((item) => item.id) : [])
            }
          />
          {copy.selectPage}
        </label>
        <span className="text-xs text-muted">
          {copy.selected}: {selected.length}
        </span>
        <button
          type="button"
          disabled={disabled || !selected.length}
          onClick={() => void mark(true)}
          className="min-h-11 rounded-lg border border-base px-3 text-sm text-accent disabled:opacity-50"
        >
          {copy.markRead}
        </button>
        <button
          type="button"
          disabled={disabled || !selected.length}
          onClick={() => void mark(false)}
          className="min-h-11 rounded-lg border border-base px-3 text-sm text-accent disabled:opacity-50"
        >
          {copy.markUnread}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="min-h-11 px-2 text-sm text-accent underline disabled:opacity-50"
        >
          {copy.retry}
        </button>
      </div>
      {!page.items.length && (
        <p className="nexus-panel p-6 text-sm text-muted">
          {filters.cursor || filters.query || filters.category !== "all" || filters.state !== "all"
            ? copy.emptyFiltered
            : copy.empty}
        </p>
      )}
      <ul className="space-y-3">
        {page.items.map((item) => (
          <li key={item.id}>
            <article
              className={`rounded-xl border p-4 ${item.isRead ? "border-base bg-surface" : "border-[color:var(--nexus-accent)]/25 bg-accent-soft"}`}
            >
              <div className="flex items-start gap-3">
                <label className="inline-flex min-h-11 min-w-6 items-center">
                  <span className="sr-only">
                    {copy.select}: {item.title}
                  </span>
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    disabled={disabled}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? current.includes(item.id)
                            ? current
                            : [...current, item.id]
                          : current.filter((id) => id !== item.id),
                      )
                    }
                  />
                </label>
                <div className="min-w-0 flex-1 space-y-2">
                  <h2 className="break-words text-sm font-bold text-primary">{item.title}</h2>
                  <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                    {item.message}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span>{copy[item.category]}</span>
                    <span>{item.isRead ? copy.read : copy.unread}</span>
                    <time dateTime={item.createdAt}>
                      {new Date(item.createdAt).toLocaleString(
                        locale === "ru" ? "ru-RU" : "en-US",
                        { timeZone: "UTC" },
                      )}{" "}
                      UTC
                    </time>
                  </div>
                  {item.truncated && <p className="text-xs text-muted">{copy.truncated}</p>}
                  <div className="flex flex-wrap items-center gap-4">
                    {item.link && (
                      <Link
                        prefetch={false}
                        href={item.link}
                        className="inline-flex min-h-11 items-center text-sm text-accent underline"
                      >
                        {copy.view}
                      </Link>
                    )}
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void mark(!item.isRead, [item.id])}
                      className="min-h-11 text-sm text-accent underline"
                    >
                      {item.isRead ? copy.markOneUnread : copy.markOneRead}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
      <nav aria-label={copy.title} className="flex flex-wrap gap-4">
        {page.newerCursor && (
          <Link
            prefetch={false}
            href={notificationInboxHref("/notifications", filters, page.newerCursor)}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.newer}
          </Link>
        )}
        {page.olderCursor && (
          <Link
            prefetch={false}
            href={notificationInboxHref("/notifications", filters, page.olderCursor)}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.older}
          </Link>
        )}
      </nav>
    </section>
  );
}
