import type { ServerStatisticsTarget } from "@nexus/db";
import { AppError, type User } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import {
  type ServerStatisticsResult,
  serverStatisticsService,
} from "../../../lib/services/servers/server-statistics-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax6xl, pageShellMax6xlDense } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { PlatformSessionError } from "../../shell/session-error";
import { typeXlBoldPrimary } from "../../shell/type-shell";
import { parseServerStatisticsQuery, serverStatisticsHref } from "../server-statistics-contract";
import { serverStatisticsCopy, serverStatisticsError } from "../server-statistics-copy";
import { ServerStatisticsPanel } from "./server-statistics-panel";
export async function serverStatisticsMetadata(): Promise<Metadata> {
  const copy = serverStatisticsCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}

export async function ServerStatisticsPage({
  target,
  managed,
  searchParams,
}: {
  target: ServerStatisticsTarget;
  managed: boolean;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const locale = await getRequestLocale(),
    copy = serverStatisticsCopy(locale);
  const path =
    managed && "id" in target
      ? `/workspace/servers/${encodeURIComponent(target.id)}/statistics`
      : "slug" in target
        ? `/servers/${encodeURIComponent(target.slug)}/statistics`
        : "/servers";
  let user: User | null = null;
  try {
    user = managed
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
  if (managed && !user) {
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
  const query = parseServerStatisticsQuery(params);
  if (!query)
    return (
      <div className={pageShellMax6xl}>
        <ErrorState
          title={copy.invalid}
          description={copy.invalidHint}
          action={
            <Link href={path} className={linkAccentSm}>
              {copy.refresh}
            </Link>
          }
        />
      </div>
    );
  let report: ServerStatisticsResult | null;
  try {
    report = await serverStatisticsService.read(
      target,
      user ? { kind: "managed", actorId: user.id } : { kind: "public" },
      query,
    );
  } catch (error) {
    const code = error instanceof AppError ? error.code : "INTERNAL_ERROR";
    const title = serverStatisticsError(locale, code);
    return (
      <div className={pageShellMax6xl}>
        <h1 className={typeXlBoldPrimary}>{copy.title}</h1>
        <ErrorState
          title={title}
          description={title === copy.unavailable ? copy.unavailableHint : undefined}
          action={
            <nav className="flex flex-wrap justify-center gap-4 text-sm">
              <Link href={serverStatisticsHref(path, query)} className={linkAccentSm}>
                {copy.retry}
              </Link>
              <Link
                href={serverStatisticsHref(path, { window: query.window })}
                className={linkAccentSm}
              >
                {copy.refresh}
              </Link>
            </nav>
          }
        />
      </div>
    );
  }
  if (!report) notFound();
  return (
    <div className={pageShellMax6xl}>
      <ServerStatisticsPanel
        report={report}
        locale={locale}
        path={path}
        managed={managed}
        before={query.before}
      />
    </div>
  );
}

export async function ServerStatisticsLoading() {
  return LocaleCopyRouteLoading({
    headingId: "server-statistics-loading-heading",
    className: pageShellMax6xlDense,
    rows: 0,
    leading: <div className="h-40 rounded-lg bg-inset" />,
    load: (locale) => {
      const copy = serverStatisticsCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}

export async function PublicServerStatisticsRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ServerStatisticsPage({
    target: { slug: (await params).slug },
    managed: false,
    searchParams: await searchParams,
  });
}

export async function ManagedServerStatisticsRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ServerStatisticsPage({
    target: { id: (await params).id },
    managed: true,
    searchParams: await searchParams,
  });
}
