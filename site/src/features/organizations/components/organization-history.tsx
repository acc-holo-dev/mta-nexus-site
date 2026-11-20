import {
  type ChangeHistoryFilters,
  ORGANIZATION_CHANGE_GROUPS,
  type OrganizationChangeGroup,
} from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import Link from "next/link";
import type { Locale } from "../../../lib/i18n";
import {
  PrivateChangeHistoryCutoff,
  PrivateChangeHistoryFilters,
} from "../../accounts/change-history";
import { privateChangeHistoryCopy } from "../../accounts/private-change-history-copy";
import { changeHistoryHref } from "../../accounts/private-change-history-query";
import { linkAccentSm, linkAccentTight } from "../../shell/link-shell";
import { pageShellMax5xlCompact as pageShellClass } from "../../shell/page-shell";
import { panelSpace3P5 } from "../../shell/panel-shell";
import type { OrganizationHistory } from "../organization-governance-contract";
import { organizationGovernanceCopy } from "../organization-governance-copy";
import { getOrganizationCopy } from "../organization-workspace-copy";
export function OrganizationHistoryView({
  data,
  id,
  before,
  locale,
  error,
  filters = { period: "all", group: "all", query: "" },
}: {
  data: OrganizationHistory | null;
  id: string;
  before?: string;
  locale: Locale;
  error?: string;
  filters?: ChangeHistoryFilters<OrganizationChangeGroup>;
}) {
  const journal = privateChangeHistoryCopy(locale),
    filtered =
      filters.period !== "all" ||
      filters.group !== "all" ||
      !!filters.query ||
      !!filters.cursor ||
      !!filters.until;
  const copy = organizationGovernanceCopy(locale),
    teamCopy = getOrganizationCopy(locale),
    path = `/workspace/organizations/${encodeURIComponent(id)}/activity`;
  return (
    <div className={pageShellClass}>
      <header className="space-y-2">
        <h1 className="break-words font-display text-primary">
          {copy.history}
          {data ? ` · ${data.organization.name}` : ""}
        </h1>
        <p className="text-sm text-muted">{copy.historyDescription}</p>
        <p className="text-xs text-muted">{copy.privacy}</p>
      </header>
      <Link className={linkAccentSm} href={`/workspace/organizations/${encodeURIComponent(id)}`}>
        {copy.back}
      </Link>
      <PrivateChangeHistoryFilters
        path={path}
        filters={filters}
        groups={ORGANIZATION_CHANGE_GROUPS}
        locale={locale}
        search
      />
      {data?.until && (
        <div className="space-y-2">
          <PrivateChangeHistoryCutoff until={data.until} locale={locale} />
          <a
            href={changeHistoryHref(
              `/api/workspace/organizations/${encodeURIComponent(id)}/activity/export`,
              filters,
              { until: data.until },
            )}
            className={linkAccentSm}
          >
            {journal.export}
          </a>
          <p className="text-xs text-muted">{journal.exportHelp}</p>
        </div>
      )}
      {!data && (
        <ErrorState
          title={error ?? copy.unavailable}
          description={copy.unavailableHint}
          action={
            <Link href={path} className={linkAccentSm}>
              {copy.reload}
            </Link>
          }
        />
      )}
      {data?.items.length === 0 && (
        <EmptyState
          title={filtered ? journal.emptyFiltered : copy.empty}
          description={filtered ? copy.emptyFilteredHint : copy.emptyHint}
          action={
            filtered ? (
              <Link href={path} className={linkAccentSm}>
                {journal.reset}
              </Link>
            ) : undefined
          }
        />
      )}
      {data?.items.map((item) => (
        <article className={panelSpace3P5} key={item.id}>
          <div className="flex flex-wrap justify-between gap-3">
            <h2 className="text-sm font-semibold text-primary">{copy.actions[item.action]}</h2>
            <time className="text-xs text-muted" dateTime={item.createdAt}>
              {new Date(item.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                timeZone: "UTC",
              })}{" "}
              UTC
            </time>
          </div>
          <p className="text-sm text-secondary">
            {copy.by}:{" "}
            {item.actorUsername ? (
              <Link
                className={linkAccentTight}
                href={`/users/${encodeURIComponent(item.actorUsername)}`}
              >
                {item.actorName} (@{item.actorUsername})
              </Link>
            ) : (
              copy.unavailableAccount
            )}
          </p>
          {item.subjectUsername && (
            <p className="text-sm text-secondary">
              {copy.subject}:{" "}
              <Link
                className={linkAccentTight}
                href={`/users/${encodeURIComponent(item.subjectUsername)}`}
              >
                {item.subjectName} (@{item.subjectUsername})
              </Link>
            </p>
          )}
          {(item.fromRole || item.toRole) && (
            <p className="text-xs text-muted">
              {copy.role}:{" "}
              {[
                item.fromRole ? teamCopy[item.fromRole] : null,
                item.toRole ? teamCopy[item.toRole] : null,
              ]
                .filter(Boolean)
                .join(" → ")}
            </p>
          )}
          {item.managesServers !== null && (
            <p className="text-xs text-muted">
              {copy.serverAccess}: {item.managesServers ? copy.enabled : copy.disabled}
            </p>
          )}
          {item.fields.length > 0 && (
            <p className="text-xs text-muted">
              {copy.fields}:{" "}
              {[...new Set(item.fields)].map((field) => copy.fieldNames[field]).join(", ")}
            </p>
          )}
        </article>
      ))}
      <nav className="flex flex-wrap gap-4 text-sm" aria-label={copy.history}>
        {(before || filters.cursor || filters.until || !data) && (
          <Link className={linkAccentSm} href={changeHistoryHref(path, filters, { fresh: true })}>
            {copy.latest}
          </Link>
        )}
        {data?.hasMore && data.nextCursor && (
          <Link
            className={linkAccentSm}
            href={
              data.until
                ? changeHistoryHref(path, filters, { cursor: data.nextCursor })
                : `${path}?before=${encodeURIComponent(data.nextCursor)}`
            }
          >
            {copy.older}
          </Link>
        )}
      </nav>
    </div>
  );
}
