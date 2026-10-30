import { Button } from "@nexus/ui";
import Link from "next/link";
import type { Locale } from "../lib/i18n";
import { type ServerHistoryWindow, serverHistoryWindows } from "../lib/server-history-window";
import { serverStatisticsHref } from "../lib/server-statistics-contract";
import { serverStatisticsCopy } from "../lib/server-statistics-copy";
import { platformFieldClass } from "../lib/user-platform-client";
export function ServerObservationPeriodControls({
  path,
  window,
  end,
  locale,
  filters = {},
}: {
  path: string;
  window: ServerHistoryWindow;
  end: string;
  locale: Locale;
  filters?: Record<string, string>;
}) {
  const copy = serverStatisticsCopy(locale),
    now = Date.now(),
    minimum = now - 90 * 86400000,
    time = Date.parse(end),
    width = serverHistoryWindows[window] * 3600000;
  const href = (period: ServerHistoryWindow, finish?: string) => {
    const url = serverStatisticsHref(path, { window: period, end: finish }),
      params = new URLSearchParams(url.split("?", 2)[1]);
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    return `${path}?${params}`;
  };
  const utc = (date: number) => new Date(date).toISOString().slice(0, 23);
  return (
    <div className="space-y-3">
      <nav aria-label={copy.windows} className="flex flex-wrap gap-2">
        {(
          [
            ["24h", copy.period24h],
            ["7d", copy.period7d],
            ["30d", copy.period30d],
          ] as const
        ).map(([period, label]) => (
          <Link
            key={period}
            prefetch={false}
            href={href(period, end)}
            aria-current={window === period ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg border border-base px-3 text-sm ${window === period ? "bg-accent-soft text-accent" : "text-secondary"}`}
          >
            {label}
          </Link>
        ))}
        <a
          href={href(window)}
          className="inline-flex min-h-11 items-center px-3 text-sm text-accent underline"
        >
          {copy.refresh}
        </a>
      </nav>
      <form method="get" action={path} className="nexus-panel flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="window" value={window} />
        {Object.entries(filters)
          .filter(([, value]) => value)
          .map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        <label className="min-w-56 space-y-1 text-xs text-muted">
          {copy.endUtc}
          <input
            type="datetime-local"
            name="endUtc"
            defaultValue={end.slice(0, 23)}
            step="0.001"
            required
            min={utc(minimum)}
            max={utc(now)}
            className={`${platformFieldClass} min-h-11`}
          />
        </label>
        <Button type="submit" className="min-h-11 font-semibold">
          {copy.choosePeriod}
        </Button>
        <p className="w-full text-xs text-muted">{copy.periodScope}</p>
      </form>
      <nav aria-label={copy.adjacent} className="flex flex-wrap gap-4">
        {time - width >= minimum && (
          <Link
            prefetch={false}
            href={href(window, new Date(time - width).toISOString())}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.previousPeriod}
          </Link>
        )}
        {time + width <= now && (
          <Link
            prefetch={false}
            href={href(window, new Date(time + width).toISOString())}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.nextPeriod}
          </Link>
        )}
      </nav>
    </div>
  );
}
