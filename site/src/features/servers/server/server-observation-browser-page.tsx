import type { ServerStatisticsTarget } from "@nexus/db";
import { AppError, type User } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Locale } from "../../../lib/i18n";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import {
  type ServerObservationBrowserResult,
  serverStatisticsService,
} from "../../../lib/services/servers/server-statistics-service";
import { platformFieldClass } from "../../community/user-platform-client";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax6xl, pageShellMax6xlDense } from "../../shell/page-shell";
import { panelFlexWrapEndP4, panelSpace3P5 } from "../../shell/panel-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { PlatformSessionError } from "../../shell/session-error";
import {
  type2xlBoldPrimary,
  typeBorderTSecondary,
  typeFlexWrapGap4,
  typeMinH11Semibold,
  typeSmMuted,
  typeSpace1XsMuted,
  typeWFullLeftSm,
  typeXlBoldPrimary,
  typeXsMuted,
} from "../../shell/type-shell";
import {
  parseServerObservationBrowserQuery,
  type ServerObservationBrowserQuery,
  serverObservationBrowserHref,
} from "../server-observation-browser-contract";
import {
  serverObservationBrowserCopy,
  serverObservationBrowserError,
} from "../server-observation-browser-copy";
import { serverStatisticsHref } from "../server-statistics-contract";
import { serverStatisticsCopy } from "../server-statistics-copy";
import { ServerStatisticsExportButton } from "../statistics-export";
import { ServerObservationPeriodControls } from "../statistics-view";
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
    <div className={pageShellMax6xl}>
      <h1 className={typeXlBoldPrimary}>{copy.title}</h1>
      <ErrorState
        title={text}
        description={
          text === copy.unavailable || text === stats.unavailable ? copy.unavailableHint : undefined
        }
        action={
          <a href={href} className={linkAccentSmRounded}>
            {stats.retry}
          </a>
        }
      />
    </div>
  );
  let actor: User | null = null;
  try {
    actor = managed
      ? await authService.getSession((await cookies()).get("nexus_session")?.value)
      : null;
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.unavailable}
        retryHref={path}
      />
    );
  }
  if (managed && !actor) {
    const returnParams = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) for (const part of value) returnParams.append(key, part);
      else if (value !== undefined) returnParams.append(key, value);
    }
    const returnPath = returnParams.size ? `${path}?${returnParams}` : path;
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
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
    },
    observationFiltersActive = Boolean(
      query.query ||
        query.players !== "all" ||
        query.password !== "all" ||
        query.responding !== "all",
    );
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
    <div className={pageShellMax6xl}>
      <header className="space-y-3">
        <Link href={base} className={linkAccentSmRounded}>
          {managed ? stats.management : stats.back}
        </Link>
        <h1 className={type2xlBoldPrimary}>{copy.title}</h1>
        <p className="break-words text-lg text-primary">{report.server.name}</p>
        <p className={typeSmMuted}>{copy.description}</p>
        {managed && <p className={typeXsMuted}>{stats.private}</p>}
        <Link
          href={serverStatisticsHref(`${base}/statistics`, {
            window: report.window,
            end: report.windowEnd,
          })}
          className={linkAccentSmRounded}
        >
          {copy.statistics}
        </Link>
        <p className={typeXsMuted}>
          <time dateTime={report.windowStart}>{time(report.windowStart)}</time> —{" "}
          <time dateTime={report.windowEnd}>{time(report.windowEnd)}</time> UTC
        </p>
        <p className={typeXsMuted}>{stats.snapshotScope}</p>
      </header>
      <ServerObservationPeriodControls
        path={path}
        window={report.window}
        end={report.windowEnd}
        locale={locale}
        filters={filters}
      />
      {report.server.endpointRevision > 0 && <p className={typeSmMuted}>{stats.lifetime}</p>}
      {!report.collectionEligible ? (
        <ErrorState
          id="server-observation-collection-paused"
          title={stats.paused}
          description={stats.pausedHint}
        />
      ) : null}
      <search aria-label={copy.search}>
        <form action={path} method="get" className={panelFlexWrapEndP4}>
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
          <label className={typeSpace1XsMuted}>
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
            <label key={key} className={typeSpace1XsMuted}>
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
          <Button type="submit" className={typeMinH11Semibold}>
            {copy.apply}
          </Button>
          {observationFiltersActive ? (
            <Link
              href={serverObservationBrowserHref(path, {
                ...state,
                query: "",
                players: "all",
                password: "all",
                responding: "all",
              })}
              className={linkAccentSmRounded}
            >
              {copy.reset}
            </Link>
          ) : null}
        </form>
      </search>
      <p className={typeSmMuted}>{copy.scope}</p>
      {report.observations.length === 0 ? (
        <EmptyState
          title={observationFiltersActive ? copy.emptyFiltered : copy.emptyNever}
          description={observationFiltersActive ? copy.emptyFilteredHint : copy.emptyNeverHint}
          action={
            observationFiltersActive ? (
              <Link
                href={serverObservationBrowserHref(path, {
                  ...state,
                  query: "",
                  players: "all",
                  password: "all",
                  responding: "all",
                })}
                className={linkAccentSmRounded}
              >
                {copy.reset}
              </Link>
            ) : undefined
          }
        />
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
          <table className={typeWFullLeftSm}>
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
                <tr key={item.id} className={typeBorderTSecondary}>
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
      <nav aria-label={stats.navigation} className={typeFlexWrapGap4}>
        <a href={serverObservationBrowserHref(path, state)} className={linkAccentSmRounded}>
          {copy.latest}
        </a>
        {report.previousCursor && (
          <Link
            prefetch={false}
            href={serverObservationBrowserHref(path, state, report.previousCursor)}
            className={linkAccentSmRounded}
          >
            {copy.newer}
          </Link>
        )}
        {report.nextCursor && (
          <Link
            prefetch={false}
            href={serverObservationBrowserHref(path, state, report.nextCursor)}
            className={linkAccentSmRounded}
          >
            {copy.older}
          </Link>
        )}
      </nav>
      <section className={panelSpace3P5}>
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
        <p className={typeSmMuted}>{copy.exportScope}</p>
      </section>
    </div>
  );
}
export async function ServerObservationBrowserLoading() {
  return LocaleCopyRouteLoading({
    headingId: "server-observations-loading-heading",
    className: pageShellMax6xlDense,
    rows: 0,
    leading: <div className="h-40 rounded-lg bg-inset" />,
    load: (locale) => {
      const copy = serverObservationBrowserCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}

export async function PublicServerObservationsRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ServerObservationBrowserPage({
    target: { slug: (await params).slug },
    managed: false,
    searchParams: await searchParams,
  });
}

export async function ManagedServerObservationsRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ServerObservationBrowserPage({
    target: { id: (await params).id },
    managed: true,
    searchParams: await searchParams,
  });
}
