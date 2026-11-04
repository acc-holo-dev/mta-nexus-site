"use client";
import { Button, EmptyState } from "@nexus/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  confirmedNotificationInboxCommand,
  NOTIFICATION_INBOX_SELECTION_LIMIT,
  type NotificationInboxPage,
  type NotificationInboxQuery,
  notificationInboxHref,
  notificationInboxPageSchema,
} from "../lib/notification-inbox-contract";
import { notificationInboxCopy, notificationInboxError } from "../lib/notification-inbox-copy";
import { announceNotificationInboxChange } from "../lib/notification-inbox-events";
import {
  fetchNotificationInboxExport,
  INBOX_EXPORT_FILE_NAME,
  NotificationInboxExportError,
} from "../lib/notification-inbox-export-client";
import { ActionConfirmCheckbox, actionConfirmCheckboxFocusClass } from "./action-confirm-checkbox";
import { confirmAction } from "./confirm-action";
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
    [exporting, setExporting] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState(""),
    [announcement, setAnnouncement] = useState(""),
    [selectionAcknowledged, setSelectionAcknowledged] = useState(false);
  const pending = useRef(false),
    controller = useRef<AbortController | null>(null),
    mounted = useRef(true),
    downloadUrl = useRef<string | null>(null),
    downloadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      clearTimeout(downloadTimer.current);
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
    };
  }, []);
  const readHref = notificationInboxHref(
    "/api/notifications/inbox",
    { ...filters, at: page.window?.until ?? filters.at },
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
  async function exportPage() {
    if (!mounted.current || pending.current || blocked) return;
    pending.current = true;
    setBusy(true);
    setExporting(true);
    setError("");
    setAnnouncement("");
    const active = new AbortController();
    controller.current = active;
    const timeout = AbortSignal.timeout(15000);
    const signal = AbortSignal.any([active.signal, timeout]);
    try {
      const blob = await fetchNotificationInboxExport(
        { ...filters, at: page.window?.until ?? filters.at },
        locale,
        signal,
      );
      if (!mounted.current) return;
      signal.throwIfAborted();
      clearTimeout(downloadTimer.current);
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
      const url = URL.createObjectURL(blob);
      downloadUrl.current = url;
      const link = document.createElement("a");
      link.href = url;
      link.download = INBOX_EXPORT_FILE_NAME;
      try {
        document.body.appendChild(link);
        link.click();
        setAnnouncement(copy.exportReady);
      } finally {
        link.remove();
        downloadTimer.current = setTimeout(() => {
          URL.revokeObjectURL(url);
          if (downloadUrl.current === url) downloadUrl.current = null;
        }, 1000);
      }
    } catch (failure) {
      if (mounted.current)
        setError(
          timeout.aborted
            ? copy.exportTimeout
            : failure instanceof NotificationInboxExportError
              ? notificationInboxError(locale, failure.code)
              : copy.exportFailed,
        );
    } finally {
      pending.current = false;
      if (mounted.current) {
        setBusy(false);
        setExporting(false);
      }
    }
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
  async function mark(isRead: boolean, ids = selected, entireInbox = false, fromSelection = false) {
    if (pending.current || blocked || (!entireInbox && !ids.length)) return;
    // Page selection uses PATCH with expectedIsRead; account-wide all-read is a separate POST.
    if (
      entireInbox &&
      (!page.unreadCount ||
        !(await confirmAction({
          title: copy.markAllRead,
          object: copy.title,
          scope: String(page.unreadCount),
          consequences: copy.allConfirm,
          confirmLabel: copy.markAllRead,
          cancelLabel: copy.reset,
          closeLabel: copy.reset,
          danger: false,
        })))
    )
      return;
    if (fromSelection) {
      if (!selectionAcknowledged) return;
      if (
        !(await confirmAction({
          title: isRead ? copy.markRead : copy.markUnread,
          object: copy.title,
          scope: String(ids.length),
          consequences: isRead ? copy.selectionReadConfirm : copy.selectionUnreadConfirm,
          confirmLabel: isRead ? copy.markRead : copy.markUnread,
          cancelLabel: copy.reset,
          closeLabel: copy.reset,
          danger: false,
        }))
      )
        return;
    }
    if (!entireInbox && ids.length > NOTIFICATION_INBOX_SELECTION_LIMIT) return;
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
            : {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(command),
              }),
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
        // Keep last confirmed unreadCount; do not present a false zero after a failed write.
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
  const emptyFiltered = Boolean(
    filters.cursor ||
      filters.query ||
      filters.category !== "all" ||
      filters.state !== "all" ||
      (filters.period && filters.period !== "all"),
  );
  const displayDate = (value: string) =>
    new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(value));
  return (
    <section className="space-y-4" aria-label={copy.title}>
      <p className="text-sm text-muted">
        {copy.totalUnread}: <strong className="text-primary">{page.unreadCount}</strong>
      </p>
      <p className="text-xs text-muted">{copy.live}</p>
      {page.window && (
        <p className="text-xs text-muted">
          {copy.window}: <time dateTime={page.window.from}>{displayDate(page.window.from)}</time>
          {" — "}
          <time dateTime={page.window.until}>{displayDate(page.window.until)}</time>
        </p>
      )}
      <div className="nexus-panel space-y-2 p-4">
        {busy || blocked ? (
          <span aria-disabled="true" className="text-sm text-muted">
            {copy.export}
          </span>
        ) : (
          <a
            href={notificationInboxHref(
              "/api/notifications/inbox/export",
              { ...filters, at: page.window?.until ?? filters.at },
              filters.cursor ? JSON.stringify(filters.cursor) : undefined,
            )}
            download="nexus-notification-page.json"
            onClick={(event) => {
              event.preventDefault();
              void exportPage();
            }}
            className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.export}
          </a>
        )}
        <p className="text-xs text-muted">{copy.exportHelp}</p>
      </div>
      {busy && (
        <p role="status" aria-live="polite" aria-busy="true" className="text-sm text-muted">
          {exporting ? copy.exportLoading : copy.loading}
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
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => void mark(true, [], true)}
            className="min-h-11 text-accent"
          >
            {copy.markAllRead}
          </Button>
        )}
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            className={actionConfirmCheckboxFocusClass}
            checked={page.items.length > 0 && selected.length === page.items.length}
            disabled={disabled || !page.items.length}
            onChange={(event) => {
              setSelectionAcknowledged(false);
              setSelected(event.target.checked ? page.items.map((item) => item.id) : []);
            }}
          />
          {copy.selectPage}
        </label>
        <span className="text-xs text-muted">
          {copy.selected}: {selected.length}
        </span>
        <ActionConfirmCheckbox
          id="notification-inbox-selection-confirm"
          checked={selectionAcknowledged}
          disabled={disabled || !selected.length}
          labelClassName="inline-flex min-h-11 items-center gap-2 text-sm text-secondary"
          checkboxClassName={actionConfirmCheckboxFocusClass}
          onCheckedChange={setSelectionAcknowledged}
        >
          {copy.selectionConfirm}
        </ActionConfirmCheckbox>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !selected.length || !selectionAcknowledged}
          onClick={() => void mark(true, selected, false, true)}
          className="min-h-11 text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.markRead}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !selected.length || !selectionAcknowledged}
          onClick={() => void mark(false, selected, false, true)}
          className="min-h-11 text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.markUnread}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => void refresh()}
          className="h-auto min-h-11 px-2 text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.retry}
        </Button>
      </div>
      {!busy && !page.items.length ? (
        <EmptyState
          title={emptyFiltered ? copy.emptyFiltered : copy.empty}
          description={emptyFiltered ? copy.emptyFilteredDescription : copy.emptyDescription}
          action={
            emptyFiltered ? (
              <Link
                prefetch={false}
                href="/notifications"
                className="inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {copy.reset}
              </Link>
            ) : undefined
          }
        />
      ) : null}
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
                    className={actionConfirmCheckboxFocusClass}
                    checked={selected.includes(item.id)}
                    disabled={disabled}
                    onChange={(event) => {
                      setSelectionAcknowledged(false);
                      setSelected((current) =>
                        event.target.checked
                          ? current.includes(item.id)
                            ? current
                            : [...current, item.id]
                          : current.filter((id) => id !== item.id),
                      );
                    }}
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
                      // Destination navigation alone does not change isRead; use the explicit mark controls.
                      <Link
                        prefetch={false}
                        href={item.link}
                        className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                      >
                        {copy.view}
                      </Link>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={disabled}
                      onClick={() => void mark(!item.isRead, [item.id])}
                      className="h-auto min-h-11 px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                    >
                      {item.isRead ? copy.markOneUnread : copy.markOneRead}
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
      <nav aria-label={copy.pageNavigation} className="flex flex-wrap gap-4">
        {page.newerCursor && (
          <Link
            prefetch={false}
            href={notificationInboxHref("/notifications", filters, page.newerCursor)}
            className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.newer}
          </Link>
        )}
        {page.olderCursor && (
          <Link
            prefetch={false}
            href={notificationInboxHref("/notifications", filters, page.olderCursor)}
            className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.older}
          </Link>
        )}
      </nav>
    </section>
  );
}
