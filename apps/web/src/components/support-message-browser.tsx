import type { SupportMessageFilters } from "@nexus/domain";
import { Button } from "@nexus/ui";
import Link from "next/link";
import type { Locale } from "../lib/i18n";
import {
  type SupportMessagePage,
  supportMessageHref,
} from "../lib/support-message-discovery-contract";
import { supportMessageCopy } from "../lib/support-message-discovery-copy";

export function SupportMessageBrowser({
  page,
  filters,
  locale,
  staff = false,
}: {
  page: SupportMessagePage;
  filters: SupportMessageFilters;
  locale: Locale;
  staff?: boolean;
}) {
  const copy = supportMessageCopy(locale),
    base = `${staff ? "/admin/support" : "/support"}/${page.supportCase.id}`,
    path = `${base}/messages`;
  const date = (value: string) =>
    new Date(value).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", { timeZone: "UTC" });
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href={base} className="text-accent underline">
        {copy.back}
      </Link>
      <header className="space-y-2">
        <h1 className="font-display text-primary">{copy.title}</h1>
        <p className="text-secondary break-words">{page.supportCase.subject}</p>
        <p className="text-sm text-muted">{copy.description}</p>
      </header>
      <form method="get" action={path} className="nexus-panel flex flex-wrap items-end gap-3 p-4">
        <label
          className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-secondary"
          htmlFor="support-message-query"
        >
          {copy.search}
          <input
            id="support-message-query"
            name="q"
            type="search"
            maxLength={80}
            defaultValue={filters.query}
            placeholder={copy.placeholder}
            className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          />
        </label>
        <label
          className="flex flex-col gap-1 text-sm text-secondary"
          htmlFor="support-message-group"
        >
          {copy.group}
          <select
            id="support-message-group"
            name="group"
            defaultValue={filters.group}
            className="rounded-lg border border-base bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            <option value="all">{copy.all}</option>
            <option value="requester">{copy.requester}</option>
            <option value="staff">{copy.staff}</option>
          </select>
        </label>
        <Button type="submit" className="min-h-10" variant="primary">
          {copy.apply}
        </Button>
        <Link href={path} className="text-sm text-accent underline">
          {copy.reset}
        </Link>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link
          href={supportMessageHref(path, filters, { fresh: true })}
          className="text-accent underline"
        >
          {copy.latest}
        </Link>
        <a
          href={supportMessageHref(`/api/support/${page.supportCase.id}/messages/export`, filters, {
            until: page.until,
          })}
          className="text-accent underline"
        >
          {copy.download}
        </a>
      </div>
      <p className="text-xs text-muted">{copy.exportHelp}</p>
      <p className="text-xs text-muted">
        {copy.snapshot}: <time dateTime={page.until}>{date(page.until)} UTC</time>
      </p>
      {page.items.length === 0 ? (
        <p role="status" className="nexus-panel p-5 text-muted">
          {copy.empty}
        </p>
      ) : (
        <section aria-label={copy.title} className="space-y-3">
          {page.items.map((message) => (
            <article
              key={message.id}
              id={`message-${message.id}`}
              className={`nexus-panel scroll-mt-24 p-4 ${message.id === page.focus ? "ring-2 ring-[var(--nexus-accent)]" : ""}`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-primary">
                  {message.authorRole === "staff" ? copy.staff : copy.requester}
                </span>
                <time dateTime={message.createdAt} className="text-muted">
                  {date(message.createdAt)} UTC
                </time>
              </div>
              {message.id === page.focus && (
                <p role="status" className="mb-2 text-sm text-accent">
                  {copy.focused}
                </p>
              )}
              <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                {message.body}
              </p>
              {message.truncated && <p className="mt-2 text-xs text-muted">{copy.truncated}</p>}
              <Link
                href={`${path}?focus=${message.id}#message-${message.id}`}
                className="mt-2 inline-flex min-h-9 items-center text-xs text-accent underline"
              >
                {copy.link}
              </Link>
            </article>
          ))}
        </section>
      )}
      <nav aria-label={copy.navigation} className="flex flex-wrap justify-between gap-3">
        {page.olderCursor && (
          <Link
            href={supportMessageHref(path, filters, {
              cursor: page.olderCursor,
              until: page.until,
            })}
            className="text-accent underline"
          >
            {copy.older}
          </Link>
        )}
        {page.newerCursor && (
          <Link
            href={supportMessageHref(path, filters, {
              cursor: page.newerCursor,
              until: page.until,
            })}
            className="text-accent underline"
          >
            {copy.newer}
          </Link>
        )}
      </nav>
    </div>
  );
}
