import { serverRepository } from "@nexus/db";
import { Button, fieldClass } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ManagedServerCard } from "../../../components/managed-server-card";
import { ManagedServerVisibilityBatch } from "../../../components/managed-server-visibility-batch";
import { getRequestLocale } from "../../../lib/i18n-server";
import {
  getManagedServerCopy,
  managedServerHref,
  parseManagedServerQuery,
} from "../../../lib/managed-server-view";
import { serverWorkspaceCopy } from "../../../lib/server-workspace-copy";
import { authService } from "../../../lib/services/auth-service";
import {
  indexMtaObservations,
  mtaMasterDirectoryService,
} from "../../../lib/services/mta-master-directory-service";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getManagedServerCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function ManagedServersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, cookieStore, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    searchParams,
  ]);
  const copy = getManagedServerCopy(locale);
  let failure = "";
  const user = await authService.getSession(cookieStore.get("nexus_session")?.value).catch(() => {
    failure = serverWorkspaceCopy(locale).unavailable;
    return null;
  });
  if (!user)
    return (
      <section className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">{copy.signInRequired}</h1>
        {failure && (
          <p role="alert" className="text-sm text-danger">
            {failure}
          </p>
        )}
        <Link href="/auth/login" className="text-sm text-accent underline">
          {copy.signIn}
        </Link>
      </section>
    );
  const { filters, page } = parseManagedServerQuery(query);
  const result = await serverRepository
    .pageManagedByUser(user.id, page, filters, 20)
    .catch(() => null);
  if (!result)
    return (
      <section className="nexus-panel space-y-3 p-5">
        <h1 className="font-display text-primary">{copy.title}</h1>
        <p role="alert" className="text-sm text-danger">
          {serverWorkspaceCopy(locale).unavailable}
        </p>
        <a
          href={managedServerHref(filters, page)}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {serverWorkspaceCopy(locale).reload}
        </a>
      </section>
    );
  const directory =
    result.servers.length > 0
      ? await mtaMasterDirectoryService.getDirectory().catch(() => null)
      : null;
  const observationFor = indexMtaObservations(directory?.servers ?? []);
  const isStale = !directory || directory.isStale;
  const filtered = Boolean(
    filters.query || filters.status || filters.visibility || filters.verification,
  );
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href="/workspace" className="text-xs font-semibold text-accent hover:underline">
            ← {copy.back}
          </Link>
          <h1 className="font-display text-primary">{copy.title}</h1>
          <p className="max-w-2xl text-sm text-muted">{copy.subtitle}</p>
        </div>
        <Link
          href="/workspace/servers/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          {copy.register}
        </Link>
      </header>
      <search aria-label={copy.search}>
        <form
          action="/workspace/servers"
          method="get"
          className="nexus-panel flex flex-wrap items-end gap-4 p-4"
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs text-secondary">
            {copy.search}
            <input
              type="search"
              name="q"
              maxLength={120}
              defaultValue={filters.query ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-secondary">
            {copy.visibility}
            <select
              name="visibility"
              defaultValue={filters.visibility ?? "all"}
              className={fieldClass}
            >
              <option value="all">{copy.all}</option>
              {(["public", "unlisted", "private"] as const).map((value) => (
                <option key={value} value={value}>
                  {copy[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-secondary">
            {copy.verification}
            <select
              name="verification"
              defaultValue={filters.verification ?? "all"}
              className={fieldClass}
            >
              <option value="all">{copy.all}</option>
              {(["verified", "unverified"] as const).map((value) => (
                <option key={value} value={value}>
                  {copy[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-secondary">
            {copy.listingStatus}
            <select name="status" defaultValue={filters.status ?? "all"} className={fieldClass}>
              <option value="all">{copy.all}</option>
              {(["active", "inactive", "maintenance", "suspended"] as const).map((value) => (
                <option key={value} value={value}>
                  {copy[value]}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="font-semibold">
            {copy.apply}
          </Button>
          {filtered && (
            <Link href="/workspace/servers" className="py-2 text-sm text-accent underline">
              {copy.reset}
            </Link>
          )}
        </form>
      </search>
      <p className="max-w-3xl text-xs text-muted">{copy.liveNote}</p>
      <p className="text-sm text-secondary">
        {copy.showing}{" "}
        {result.total === 0
          ? "0"
          : `${(result.page - 1) * result.pageSize + 1}–${(result.page - 1) * result.pageSize + result.servers.length}`}{" "}
        {copy.of} {result.total}
      </p>
      {result.servers.length === 0 ? (
        <p className="nexus-panel p-8 text-center text-sm text-muted">
          {filtered ? copy.emptyFilter : copy.empty}
        </p>
      ) : (
        <ManagedServerVisibilityBatch
          key={`${result.page}:${JSON.stringify(filters)}:${result.servers.map((server) => `${server.id}:${server.visibility}:${server.updatedAt.toISOString()}`).join(":")}`}
          locale={locale}
          items={result.servers.map((server) => ({
            id: server.id,
            name: server.name,
            card: (
              <ManagedServerCard
                key={server.id}
                server={server}
                observation={observationFor(server)}
                isStale={isStale}
                locale={locale}
              />
            ),
          }))}
        />
      )}
      {result.totalPages > 1 && (
        <nav aria-label={copy.page} className="flex flex-wrap items-center gap-4 text-sm">
          {result.page > 1 && (
            <Link
              href={managedServerHref(filters, result.page - 1)}
              className="text-accent underline"
            >
              {copy.previous}
            </Link>
          )}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link
              href={managedServerHref(filters, result.page + 1)}
              className="text-accent underline"
            >
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
