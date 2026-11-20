import {
  type ChangeHistoryFilters,
  PROFILE_CHANGE_GROUPS,
  type ProfileChangeGroup,
} from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import Link from "next/link";
import type { Locale } from "../../../lib/i18n";
import { pageShellMax5xlCompact as pageShellClass } from "../../shell/page-shell";
import { panelClipSpace3P5 } from "../../shell/panel-shell";
import { privateChangeHistoryCopy } from "../private-change-history-copy";
import { changeHistoryHref } from "../private-change-history-query";
import type { ProfileChangeHistory } from "../profile-change-history-contract";
import { linkAccentSmRounded } from "../../shell/link-shell";
import {
  PrivateChangeHistoryCutoff,
  PrivateChangeHistoryFilters,
} from "./private-change-history-controls";

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
      <Link href="/settings" className={linkAccentSmRounded}>
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
          title={error ?? copy.unavailable}
          description={copy.unavailableHint}
          action={
            <Link
              href={changeHistoryHref(path, filters, { fresh: true })}
              className={linkAccentSmRounded}
            >
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
              className={linkAccentSmRounded}
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
                  <Link href={path} className={linkAccentSmRounded}>
                    {copy.reset}
                  </Link>
                ) : undefined
              }
            />
          )}
          {data.items.map((item) => (
            <article key={item.id} className={panelClipSpace3P5}>
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
          <Link
            className={linkAccentSmRounded}
            href={changeHistoryHref(path, filters, { fresh: true })}
          >
            {copy.latest}
          </Link>
        )}
        {data?.hasMore && data.nextCursor && (
          <Link
            className={linkAccentSmRounded}
            href={changeHistoryHref(path, filters, { cursor: data.nextCursor })}
          >
            {copy.older}
          </Link>
        )}
      </nav>
    </div>
  );
}
