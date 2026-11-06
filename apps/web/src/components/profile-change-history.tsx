import {
  type ChangeHistoryFilters,
  PROFILE_CHANGE_GROUPS,
  type ProfileChangeGroup,
} from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import Link from "next/link";
import type { Locale } from "../lib/i18n";
import { privateChangeHistoryCopy } from "../lib/private-change-history-copy";
import { changeHistoryHref } from "../lib/private-change-history-query";
import type { ProfileChangeHistory } from "../lib/profile-change-history-contract";
import {
  PrivateChangeHistoryCutoff,
  PrivateChangeHistoryFilters,
} from "./private-change-history-controls";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-5 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export function ProfileChangeHistoryView({
  data,
  filters,
  locale,
  error,
}: {
  data: ProfileChangeHistory | null;
  filters: ChangeHistoryFilters<ProfileChangeGroup>;
  locale: Locale;
  error?: string;
}) {
  const copy = privateChangeHistoryCopy(locale),
    path = "/settings/history",
    filtered =
      filters.period !== "all" ||
      filters.group !== "all" ||
      !!filters.query ||
      !!filters.cursor ||
      !!filters.until;
  return (
    <div className={pageShellClass}>
      <header className="space-y-2">
        <h1 className="font-display text-primary">{copy.profileTitle}</h1>
        <p className="text-sm text-muted">{copy.profileDescription}</p>
        <p className="text-xs text-muted">{copy.privacy}</p>
        <p className="text-xs text-muted">{copy.recorded}</p>
      </header>
      <Link href="/settings" className={navLinkClass}>
        {copy.back}
      </Link>
      <PrivateChangeHistoryFilters
        path={path}
        filters={filters}
        groups={PROFILE_CHANGE_GROUPS}
        locale={locale}
      />
      {!data ? (
        <ErrorState
          id="profile-change-history-unavailable"
          title={error ?? copy.unavailable}
          action={
            <Link href={changeHistoryHref(path, filters, { fresh: true })} className={navLinkClass}>
              {copy.reload}
            </Link>
          }
        />
      ) : (
        <>
          <PrivateChangeHistoryCutoff until={data.until} locale={locale} />
          <div className="space-y-2">
            <a
              href={changeHistoryHref("/api/account/profile/history/export", filters, {
                until: data.until,
              })}
              className={navLinkClass}
            >
              {copy.export}
            </a>
            <p className="text-xs text-muted">{copy.exportHelp}</p>
          </div>
          {!data.items.length && (
            <EmptyState
              title={filtered ? copy.emptyFiltered : copy.empty}
              description={filtered ? copy.emptyFilteredHint : copy.emptyHint}
              action={
                filtered ? (
                  <Link href={path} className={navLinkClass}>
                    {copy.reset}
                  </Link>
                ) : undefined
              }
            />
          )}
          {data.items.map((item) => (
            <article key={item.id} className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="text-sm font-semibold text-primary">{copy.actions[item.action]}</h2>
                <time dateTime={item.createdAt} className="text-xs text-muted">
                  {new Date(item.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </time>
              </div>
              <p className="text-sm text-secondary">
                {item.actor === "you" ? copy.you : copy.system}
              </p>
              {!!item.fields.length && (
                <p className="text-xs text-muted">
                  {copy.fields}: {item.fields.map((field) => copy.fieldNames[field]).join(", ")}
                </p>
              )}
              {item.experienceVerificationInvalidated && (
                <p className="text-sm text-muted">
                  {copy.invalidated}{" "}
                  <Link
                    href="/workspace/verification"
                    className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  >
                    {copy.verification}
                  </Link>
                </p>
              )}
            </article>
          ))}
        </>
      )}
      <nav aria-label={copy.profileTitle} className="flex flex-wrap gap-4 text-sm">
        {(filters.cursor || filters.until || !data) && (
          <Link className={navLinkClass} href={changeHistoryHref(path, filters, { fresh: true })}>
            {copy.latest}
          </Link>
        )}
        {data?.hasMore && data.nextCursor && (
          <Link
            className={navLinkClass}
            href={changeHistoryHref(path, filters, { cursor: data.nextCursor })}
          >
            {copy.older}
          </Link>
        )}
      </nav>
    </div>
  );
}
