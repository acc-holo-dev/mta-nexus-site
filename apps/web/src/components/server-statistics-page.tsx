import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError, type User } from "@nexus/domain";
import type { ServerStatisticsTarget } from "@nexus/db";
import { authService } from "../lib/services/auth-service";
import {
  serverStatisticsService,
  type ServerStatisticsResult,
} from "../lib/services/server-statistics-service";
import { getRequestLocale } from "../lib/i18n-server";
import {
  parseServerStatisticsQuery,
  serverStatisticsHref,
} from "../lib/server-statistics-contract";
import { serverStatisticsCopy, serverStatisticsError } from "../lib/server-statistics-copy";
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
      <div className="nexus-panel space-y-3 p-5">
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <p role="alert" className="text-sm text-danger">
          {copy.unavailable}
        </p>
        <a href={path} className="inline-flex min-h-11 items-center text-sm text-accent underline">
          {copy.retry}
        </a>
      </div>
    );
  }
  if (managed && !user)
    return (
      <div className="mx-auto max-w-md space-y-4 py-20 text-center">
        <h1 className="text-xl font-bold text-primary">{copy.signIn}</h1>
        <Link
          href="/auth/login"
          className="inline-block min-h-11 rounded-lg bg-accent-soft px-4 py-2 text-accent"
        >
          {copy.signInAction}
        </Link>
      </div>
    );
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams))
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value])
      params.append(key, item);
  const query = parseServerStatisticsQuery(params);
  if (!query)
    return (
      <div className="nexus-panel space-y-4 p-6">
        <p role="alert" className="text-sm text-danger">
          {copy.invalid}
        </p>
        <Link href={path} className="inline-block min-h-11 text-sm text-accent underline">
          {copy.refresh}
        </Link>
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
      <div className="nexus-panel space-y-4 p-6">
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <p role="alert" className="text-sm text-danger">
          {serverStatisticsError(locale, code)}
        </p>
        <nav className="flex flex-wrap gap-4 text-sm text-accent">
          <Link href={serverStatisticsHref(path, query)} className="min-h-11 underline">
            {copy.retry}
          </Link>
          <Link
            href={serverStatisticsHref(path, { window: query.window })}
            className="min-h-11 underline"
          >
            {copy.refresh}
          </Link>
        </nav>
      </div>
    );
  }
  if (!report) notFound();
  return (
    <div className="mx-auto min-w-0 max-w-6xl py-8">
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
    <div className="mx-auto max-w-6xl space-y-4 py-8" role="status" aria-busy="true">
      <p className="text-lg font-bold text-primary">{copy.title}</p>
      <div className="h-40 animate-pulse rounded-lg bg-inset" aria-hidden="true" />
    </div>
  );
}
