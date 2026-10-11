import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError, type User } from "@nexus/domain";
import type { ServerStatisticsTarget } from "@nexus/db";
import { authService } from "../lib/services/auth-service";
import {
  serverStatisticsService,
  type ServerObservationBrowserResult,
} from "../lib/services/server-statistics-service";
import { getRequestLocale } from "../lib/i18n-server";
import {
  serverObservationBrowserCopy,
  serverObservationBrowserError,
} from "../lib/server-observation-browser-copy";
import {
  parseServerObservationBrowserQuery,
  serverObservationBrowserHref,
  type ServerObservationBrowserQuery,
} from "../lib/server-observation-browser-contract";
import { serverStatisticsCopy } from "../lib/server-statistics-copy";
import { serverStatisticsHref } from "../lib/server-statistics-contract";
import { platformFieldClass } from "../lib/user-platform-client";
import { ServerObservationPeriodControls } from "./server-observation-period-controls";
import { ServerStatisticsExportButton } from "./server-statistics-export-button";
import type { Locale } from "../lib/i18n";
export async function serverObservationBrowserMetadata() {
  const copy = serverObservationBrowserCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}
export async function ServerObservationBrowserPage({
  target,
  managed,
  searchParams,
}: {
  target: ServerStatisticsTarget;
  managed: boolean;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const locale = await getRequestLocale(),
    copy = serverObservationBrowserCopy(locale),
    stats = serverStatisticsCopy(locale);
  const path =
    managed && "id" in target
      ? `/workspace/servers/${encodeURIComponent(target.id)}/observations`
      : "slug" in target
        ? `/servers/${encodeURIComponent(target.slug)}/observations`
        : "/servers";
  const failure = (text: string, href = path) => (
    <div className="nexus-panel space-y-3 p-5">
      <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
      <p role="alert" className="text-sm text-danger">
        {text}
      </p>
      <a href={href} className="inline-flex min-h-11 items-center text-sm text-accent underline">
        {stats.retry}
      </a>
    </div>
  );
  let actor: User | null = null;
  try {
    actor = managed
      ? await authService.getSession((await cookies()).get("nexus_session")?.value)
      : null;
  } catch {
    return failure(copy.unavailable);
  }
  if (managed && !actor)
    return (
      <div className="nexus-panel space-y-3 p-5">
        <h1 className="text-xl font-bold text-primary">{copy.signIn}</h1>
        <Link
          href="/auth/login"
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {stats.signInAction}
        </Link>
      </div>
    );
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams))
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value])
      params.append(key, item);
  const query = parseServerObservationBrowserQuery(params);
  if (!query) return failure(copy.invalid);
  let report: ServerObservationBrowserResult | null;
  try {
    report = await serverStatisticsService.observations(
      target,
      actor ? { kind: "managed", actorId: actor.id } : { kind: "public" },
      query,
    );
  } catch (error) {
    return failure(
      serverObservationBrowserError(
        locale,
        error instanceof AppError ? error.code : "INTERNAL_ERROR",
      ),
      serverObservationBrowserHref(path, query),
    );
  }
  if (!report) notFound();
  return (
    <ServerObservationBrowserPanel
      report={report}
      query={query}
      path={path}
      locale={locale}
      managed={managed}
    />
  );
}
function ServerObservationBrowserPanel({
  report,
  query,
  path,
  locale,
  managed,
}: {
  report: ServerObservationBrowserResult;
  query: ServerObservationBrowserQuery;
  path: string;
  locale: Locale;
  managed: boolean;
}) {
  const copy = serverObservationBrowserCopy(locale),
    stats = serverStatisticsCopy(locale),
    state = { ...query, end: report.windowEnd };
  const base = managed
    ? `/workspace/servers/${encodeURIComponent(report.server.id)}`
    : `/servers/${encodeURIComponent(report.server.slug)}`;
  const field = `${platformFieldClass} min-h-11`,
    filters = {
      q: query.query,
      players: query.players,
      password: query.password,
      responding: query.responding,
    };
  const time = (value: string) =>
    new Date(value).toLocaleString(locale === "ru" ? "ru-RU" : "en-GB", {
      timeZone: "UTC",
      dateStyle: "medium",
      timeStyle: "medium",
    });
  const metric = (value: number | null) => (value === null ? stats.unknown : String(value));
  const flag = (value: boolean | null) =>
    value === null ? stats.unknown : value ? stats.yes : stats.no;
  return (
    <div className="mx-auto max-w-6xl space-y-6 py-8">
      <header className="space-y-3">
        <Link
          href={base}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {managed ? stats.management : stats.back}
        </Link>
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <p className="break-words text-lg text-primary">{report.server.name}</p>
        <p className="text-sm text-muted">{copy.description}</p>
        {managed && <p className="text-xs text-muted">{stats.private}</p>}
        <Link
          href={serverStatisticsHref(`${base}/statistics`, {
            window: report.window,
            end: report.windowEnd,
          })}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.statistics}
        </Link>
        <p className="text-xs text-muted">
          <time dateTime={report.windowStart}>{time(report.windowStart)}</time> —{" "}
          <time dateTime={report.windowEnd}>{time(report.windowEnd)}</time> UTC
        </p>
        <p className="text-xs text-muted">{stats.snapshotScope}</p>
      </header>
      <ServerObservationPeriodControls
        path={path}
        window={report.window}
        end={report.windowEnd}
        locale={locale}
        filters={filters}
      />
      {report.server.endpointRevision > 0 && <p className="text-sm text-muted">{stats.lifetime}</p>}
      {!report.collectionEligible && <p className="text-sm text-muted">{stats.paused}</p>}
      <form action={path} method="get" className="nexus-panel flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="window" value={report.window} />
        <input type="hidden" name="end" value={report.windowEnd} />
        <label className="min-w-48 flex-1 space-y-1 text-xs text-muted">
          {copy.search}
          <input
            type="search"
            name="q"
            maxLength={100}
            defaultValue={query.query}
            className={field}
          />
        </label>
        <label className="space-y-1 text-xs text-muted">
          {copy.players}
          <select name="players" defaultValue={query.players} className={field}>
            {(["all", "known", "unknown", "zero"] as const).map((value) => (
              <option key={value} value={value}>
                {copy[value]}
              </option>
            ))}
          </select>
        </label>
        {(["password", "responding"] as const).map((key) => (
          <label key={key} className="space-y-1 text-xs text-muted">
            {copy[key]}
            <select name={key} defaultValue={query[key]} className={field}>
              {(["all", "yes", "no", "unknown"] as const).map((value) => (
                <option key={value} value={value}>
                  {copy[value]}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white"
        >
          {copy.apply}
        </button>
        <Link
          href={serverObservationBrowserHref(path, {
            ...state,
            query: "",
            players: "all",
            password: "all",
            responding: "all",
          })}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.reset}
        </Link>
      </form>
      <p className="text-sm text-muted">{copy.scope}</p>
      {report.observations.length === 0 ? (
        <p className="nexus-panel p-5 text-sm text-muted">{copy.empty}</p>
      ) : (
        <section
          aria-labelledby="observation-browser-table"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: The named overflow region supports keyboard scrolling of the observation table.
          tabIndex={0}
          className="nexus-panel overflow-x-auto p-4 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <h2 id="observation-browser-table" className="sr-only">
            {stats.observations}
          </h2>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{copy.scope}</caption>
            <thead>
              <tr>
                {[
                  stats.time,
                  stats.players,
                  stats.capacity,
                  stats.mode,
                  stats.map,
                  stats.version,
                  stats.password,
                  stats.responding,
                ].map((label) => (
                  <th key={label} scope="col" className="whitespace-nowrap p-2 text-muted">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.observations.map((item) => (
                <tr key={item.id} className="border-t border-base text-secondary">
                  <th scope="row" className="whitespace-nowrap p-2 font-normal">
                    <time dateTime={item.observedAt} className="font-mono text-xs">
                      {item.observedAt}
                    </time>
                  </th>
                  <td className="p-2">{metric(item.currentPlayers)}</td>
                  <td className="p-2">{metric(item.maxPlayers)}</td>
                  {(["gameMode", "mapName", "mtaVersion"] as const).map((key) => (
                    <td key={key} className="min-w-24 max-w-60 break-words p-2">
                      {item[key] ?? stats.unknown}
                    </td>
                  ))}
                  <td className="p-2">{flag(item.passworded)}</td>
                  <td className="p-2">{flag(item.responding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <nav aria-label={stats.navigation} className="flex flex-wrap gap-4">
        <a
          href={serverObservationBrowserHref(path, state)}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.latest}
        </a>
        {report.previousCursor && (
          <Link
            prefetch={false}
            href={serverObservationBrowserHref(path, state, report.previousCursor)}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.newer}
          </Link>
        )}
        {report.nextCursor && (
          <Link
            prefetch={false}
            href={serverObservationBrowserHref(path, state, report.nextCursor)}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.older}
          </Link>
        )}
      </nav>
      <section className="nexus-panel space-y-3 p-5">
        <ServerStatisticsExportButton
          url={serverObservationBrowserHref(
            `${managed ? "/api/workspace" : "/api"}/servers/${encodeURIComponent(report.server.id)}/observations/export`,
            state,
            query.cursor ? JSON.stringify(query.cursor) : undefined,
          )}
          label={copy.export}
          locale={locale}
          disabled={report.observations.length === 0}
        />
        <p className="text-sm text-muted">{copy.exportScope}</p>
      </section>
    </div>
  );
}
export async function ServerObservationBrowserLoading() {
  const copy = serverObservationBrowserCopy(await getRequestLocale());
  return (
    <div role="status" aria-busy="true" className="mx-auto max-w-6xl space-y-4 py-8">
      <p className="text-lg font-bold text-primary">{copy.loading}</p>
      <div className="h-40 animate-pulse rounded-lg bg-inset" aria-hidden="true" />
    </div>
  );
}
