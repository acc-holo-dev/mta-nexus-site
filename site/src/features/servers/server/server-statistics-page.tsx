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
import { HonestLoadingShell } from "../../shell/honest-loading";
import { PlatformSessionError } from "../../shell/session-error";
import { parseServerStatisticsQuery, serverStatisticsHref } from "../server-statistics-contract";
import { serverStatisticsCopy, serverStatisticsError } from "../server-statistics-copy";
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
      <div className={pageShellClass}>
        <ErrorState
          title={copy.invalid}
          description={copy.invalidHint}
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
    const title = serverStatisticsError(locale, code);
    return (
      <div className={pageShellClass}>
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <ErrorState
          title={title}
          description={title === copy.unavailable ? copy.unavailableHint : undefined}
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
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-6xl space-y-4 overflow-x-clip py-8"
      headingId="server-statistics-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
    >
      <div className="h-40 animate-pulse rounded-lg bg-inset" aria-hidden="true" />
    </HonestLoadingShell>
  );
}
