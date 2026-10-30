import { CHANGE_HISTORY_PERIODS, type ChangeHistoryFilters } from "@nexus/domain";
import { Button, Input } from "@nexus/ui";
import Link from "next/link";
import type { Locale } from "../lib/i18n";
import { privateChangeHistoryCopy } from "../lib/private-change-history-copy";

const selectClass =
  "h-10 w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const labelClass = "block font-label uppercase text-secondary";

export function PrivateChangeHistoryFilters<
  Group extends keyof ReturnType<typeof privateChangeHistoryCopy>["groups"],
>({
  path,
  filters,
  groups,
  locale,
  search = false,
}: {
  path: string;
  filters: ChangeHistoryFilters<Group>;
  groups: readonly Group[];
  locale: Locale;
  search?: boolean;
}) {
  const copy = privateChangeHistoryCopy(locale);
  return (
    <form method="get" action={path} className="nexus-panel flex flex-wrap items-end gap-4 p-4">
      <label className="min-w-0 flex-1 space-y-1.5 text-sm text-secondary">
        <span className={labelClass}>{copy.period}</span>
        <select name="period" className={selectClass} defaultValue={filters.period}>
          {CHANGE_HISTORY_PERIODS.map((period) => (
            <option key={period} value={period}>
              {copy.periods[period]}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 flex-1 space-y-1.5 text-sm text-secondary">
        <span className={labelClass}>{copy.group}</span>
        <select name="group" className={selectClass} defaultValue={filters.group}>
          {groups.map((group) => (
            <option key={group} value={group}>
              {copy.groups[group]}
            </option>
          ))}
        </select>
      </label>
      {search && (
        <div className="min-w-0 basis-full space-y-1.5">
          <Input
            name="q"
            type="search"
            label={copy.search}
            maxLength={80}
            defaultValue={filters.query}
            aria-describedby="change-history-search-help"
          />
          <span id="change-history-search-help" className="block text-xs text-muted">
            {copy.searchHelp}
          </span>
        </div>
      )}
      <Button type="submit" variant="secondary">
        {copy.apply}
      </Button>
      <Link href={path} className="inline-flex min-h-11 items-center text-sm text-accent underline">
        {copy.reset}
      </Link>
    </form>
  );
}
export function PrivateChangeHistoryCutoff({ until, locale }: { until: string; locale: Locale }) {
  const copy = privateChangeHistoryCopy(locale);
  return (
    <p className="text-xs text-muted">
      {copy.until}:{" "}
      <time dateTime={until}>
        {new Date(until).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", { timeZone: "UTC" })}{" "}
        UTC
      </time>
    </p>
  );
}
export function ProfileChangeHistoryLink({ locale }: { locale: Locale }) {
  return (
    <Link
      href="/settings/history"
      className="inline-flex min-h-11 items-center text-sm text-accent underline"
    >
      {privateChangeHistoryCopy(locale).profileTitle}
    </Link>
  );
}
