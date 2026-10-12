import {
  type ChangeHistoryFilters,
  ORGANIZATION_CHANGE_GROUPS,
  type OrganizationChangeGroup,
} from "@nexus/domain";
import Link from "next/link";
import type { Locale } from "../lib/i18n";
import type { OrganizationHistory } from "../lib/organization-governance-contract";
import { organizationGovernanceCopy } from "../lib/organization-governance-copy";
import { getOrganizationCopy } from "../lib/organization-workspace-copy";
import { privateChangeHistoryCopy } from "../lib/private-change-history-copy";
import { changeHistoryHref } from "../lib/private-change-history-query";
import {
  PrivateChangeHistoryCutoff,
  PrivateChangeHistoryFilters,
} from "./private-change-history-controls";
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
  const journal = privateChangeHistoryCopy(locale);
  const copy = organizationGovernanceCopy(locale),
    teamCopy = getOrganizationCopy(locale),
    path = `/workspace/organizations/${encodeURIComponent(id)}/activity`;
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="break-words font-display text-primary">
          {copy.history}
          {data ? ` · ${data.organization.name}` : ""}
        </h1>
        <p className="text-sm text-muted">{copy.historyDescription}</p>
        <p className="text-xs text-muted">{copy.privacy}</p>
      </header>
      <Link
        className="inline-flex min-h-9 items-center text-sm text-accent underline"
        href={`/workspace/organizations/${encodeURIComponent(id)}`}
      >
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
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {journal.export}
          </a>
          <p className="text-xs text-muted">{journal.exportHelp}</p>
        </div>
      )}
      {!data && (
        <p role="alert" className="nexus-panel p-5 text-sm text-danger">
          {error ?? copy.unavailable}
        </p>
      )}
      {data?.items.length === 0 && (
        <p className="nexus-panel p-5 text-sm text-muted">{journal.empty}</p>
      )}
      {data?.items.map((item) => (
        <article className="nexus-panel space-y-3 p-5" key={item.id}>
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
                className="text-accent underline"
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
                className="text-accent underline"
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
          <Link
            className="min-h-9 py-2 text-accent underline"
            href={changeHistoryHref(path, filters, { fresh: true })}
          >
            {copy.latest}
          </Link>
        )}
        {data?.hasMore && data.nextCursor && (
          <Link
            className="min-h-9 py-2 text-accent underline"
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
