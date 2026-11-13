import type { ServerStatisticsTarget } from "@nexus/db";
import { AppError, type User } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestLocale } from "../lib/i18n-server";
import {
  parseServerStatisticsQuery,
  serverStatisticsHref,
} from "../lib/server-statistics-contract";
import { serverStatisticsCopy, serverStatisticsError } from "../lib/server-statistics-copy";
import { authService } from "../lib/services/auth-service";
import {
  type ServerStatisticsResult,
  serverStatisticsService,
} from "../lib/services/server-statistics-service";
import { PlatformSignIn } from "./platform-sign-in";
import { ServerStatisticsPanel } from "./server-statistics-panel";

const pageShellClass = "mx-auto min-w-0 max-w-6xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

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
      <div className={pageShellClass}>
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <ErrorState
          title={copy.unavailable}
          action={
            <a href={path} className={navLinkClass}>
              {copy.retry}
            </a>
          }
        />
      </div>
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
      <div className={pageShellClass}>
        <ErrorState
          title={copy.invalid}
          action={
            <Link href={path} className={navLinkClass}>
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
    return (
      <div className={pageShellClass}>
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <ErrorState
          title={serverStatisticsError(locale, code)}
          action={
            <nav className="flex flex-wrap justify-center gap-4 text-sm">
              <Link href={serverStatisticsHref(path, query)} className={navLinkClass}>
                {copy.retry}
              </Link>
              <Link
                href={serverStatisticsHref(path, { window: query.window })}
                className={navLinkClass}
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
    <div className={pageShellClass}>
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
  const copy = serverStatisticsCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-clip py-8"
      aria-busy="true"
      aria-labelledby="server-statistics-loading-heading"
    >
      <header className="space-y-2">
        <h1 id="server-statistics-loading-heading" className="font-display text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="h-40 animate-pulse rounded-lg bg-inset" aria-hidden="true" />
    </section>
  );
}
