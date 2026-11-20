import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { buildPackageService } from "../../../lib/services/resources/build-package-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccent } from "../../shell/link-shell";
import { pageShellMax5xl } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { surfaceSpace2P4TextSm } from "../../shell/surface-shell";
import {
  typeDisplayPrimary,
  typeFlexGap4Sm,
  typeGridGap4Md2,
  typeSmMuted,
  typeSpace1Sm,
} from "../../shell/type-shell";
import { buildPackageCopy } from "../build-package-i18n";
import { buildPackageQueryHref, parseBuildPackageQuery } from "../build-package-query";

function packageAccessError(error: unknown): "missing" | "failed" {
  if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) return "missing";
  return "failed";
}

function BuildPackageLoadError({
  locale,
  backHref,
  retryHref,
}: {
  locale: "en" | "ru";
  backHref: string;
  retryHref: string;
}) {
  const copy = buildPackageCopy(locale),
    dictionary = getDictionary(locale);
  return (
    <section className={pageShellMax5xl}>
      <Link href={backHref} className={linkAccent}>
        {copy.back}
      </Link>
      <ErrorState
        title={copy.loadUnavailable}
        description={copy.loadUnavailableHint}
        action={
          <Link href={retryHref} className={linkAccent}>
            {dictionary.errors.retry}
          </Link>
        }
      />
    </section>
  );
}

export async function buildPackageMetadata(): Promise<Metadata> {
  return {
    title: `${buildPackageCopy(await getRequestLocale()).reviewDocumentTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function BuildPackageScreen({
  productId,
  buildId,
  searchParams,
  staff = false,
}: {
  productId: string;
  buildId: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  staff?: boolean;
}) {
  const locale = await getRequestLocale(),
    copy = buildPackageCopy(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={"/"}
      />
    );
  }

  const rawSearchParams = await searchParams;
  const returnQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (Array.isArray(value)) for (const item of value) returnQuery.append(key, item);
    else if (value !== undefined) returnQuery.append(key, value);
  }
  const packageBase = `/${staff ? "admin/resources" : "workspace/resources"}/${encodeURIComponent(productId)}/builds/${encodeURIComponent(buildId)}/package`;
  const returnPath = returnQuery.size ? `${packageBase}?${returnQuery}` : packageBase;
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (Array.isArray(value)) for (const item of value) queryParams.append(key, item);
    else if (value !== undefined) queryParams.append(key, value);
  }
  const query = parseBuildPackageQuery(queryParams);
  if (!query) notFound();
  const base = `/${staff ? "admin/resources" : "workspace/resources"}/${encodeURIComponent(productId)}/builds/${encodeURIComponent(buildId)}`;
  let detail: Awaited<ReturnType<typeof buildPackageService.page>> | null = null;
  try {
    detail = await buildPackageService.page(actor, productId, buildId, query, staff);
  } catch (error) {
    if (packageAccessError(error) === "missing") notFound();
    return <BuildPackageLoadError locale={locale} backHref={base} retryHref={returnPath} />;
  }
  const pageBase = `${base}/package`;
  const labels = {
    all: copy.all,
    recorded: copy.recorded,
    added: copy.added,
    removed: copy.removed,
    changed: copy.changed,
    unchanged: copy.unchanged,
  };
  const options =
    detail.baseline && !detail.candidates.some((v) => v.id === detail.baseline?.id)
      ? [detail.baseline, ...detail.candidates]
      : detail.candidates;
  return (
    <div className={pageShellMax5xl}>
      <Link href={base} className={linkAccent}>
        {copy.back}
      </Link>
      <header className="space-y-2">
        <h1 className={typeDisplayPrimary}>{copy.inventory}</h1>
        <p className="text-secondary">
          {detail.product.title} · {detail.build.version}
        </p>
      </header>
      <p className={typeSmMuted}>{copy.comparisonNote}</p>
      {!detail.build.hasInventory ? (
        <ErrorState title={copy.legacy} description={copy.legacyHint} />
      ) : null}
      {detail.build.hasInventory && !detail.comparisonAvailable ? (
        <ErrorState title={copy.noBaseline} description={copy.noBaselineHint} />
      ) : null}
      <form
        method="get"
        action={pageBase}
        className="flex flex-wrap items-end gap-4 rounded-lg border border-base p-4"
      >
        <label className={typeSpace1Sm}>
          <span className="block">{copy.baseline}</span>
          <select
            name="baseline"
            defaultValue={detail.baseline?.id ?? ""}
            className="rounded border border-base bg-surface p-2 text-primary"
          >
            <option value="" disabled>
              {copy.choose}
            </option>
            {options.map((v) => (
              <option value={v.id} key={v.id}>
                {v.version}
              </option>
            ))}
          </select>
        </label>
        <label className={typeSpace1Sm}>
          <span className="block">{copy.filter}</span>
          <select
            name="filter"
            defaultValue={detail.filter}
            disabled={!detail.comparisonAvailable}
            className="rounded border border-base bg-surface p-2 text-primary"
          >
            {(["all", "added", "removed", "changed", "unchanged"] as const).map((v) => (
              <option value={v} key={v}>
                {labels[v]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={options.length === 0} variant="outline" size="touch">
          {copy.apply}
        </Button>
        <Link href={pageBase} className={linkAccent}>
          {copy.reset}
        </Link>
      </form>
      {detail.comparisonAvailable && (
        <p className="text-sm">
          {copy.baseline}: {detail.baseline?.version} → {detail.build.version}
        </p>
      )}
      <dl className="flex flex-wrap gap-5 text-sm">
        {detail.counts.map((v) => (
          <div key={v.status}>
            <dt>{labels[v.status]}</dt>
            <dd>{v.total.toLocaleString(locale)}</dd>
          </div>
        ))}
      </dl>
      <ol className="space-y-3">
        {detail.files.map((file) => (
          <li key={file.path} className={surfaceSpace2P4TextSm}>
            <p className="break-words font-code">{file.path}</p>
            <p className="text-secondary">{labels[file.status]}</p>
            <dl className={typeGridGap4Md2}>
              {file.beforeHash && (
                <div>
                  <dt>{copy.before}</dt>
                  <dd className="break-all font-code">{file.beforeHash}</dd>
                  <dd>{file.beforeSize?.toLocaleString(locale)} B</dd>
                </div>
              )}
              {file.afterHash && (
                <div>
                  <dt>{copy.after}</dt>
                  <dd className="break-all font-code">{file.afterHash}</dd>
                  <dd>{file.afterSize?.toLocaleString(locale)} B</dd>
                </div>
              )}
            </dl>
          </li>
        ))}
      </ol>
      {detail.files.length === 0 && detail.build.hasInventory && (
        <EmptyState
          title={copy.noFiles}
          description={copy.noFilesHint}
          action={
            detail.filter !== "all" ? (
              <Link
                href={buildPackageQueryHref(pageBase, {
                  ...query,
                  baselineId: detail.baseline?.id,
                  filter: "all",
                  page: 1,
                })}
                className={linkAccent}
              >
                {copy.reset}
              </Link>
            ) : undefined
          }
        />
      )}
      {detail.totalPages > 1 && (
        <nav className={typeFlexGap4Sm} aria-label={copy.inventory}>
          {detail.page > 1 && (
            <Link
              className={linkAccent}
              href={buildPackageQueryHref(pageBase, {
                ...query,
                baselineId: detail.baseline?.id,
                filter: detail.filter,
                page: detail.page - 1,
              })}
            >
              {copy.previous}
            </Link>
          )}
          <span>
            {detail.page} / {detail.totalPages}
          </span>
          {detail.page < detail.totalPages && (
            <Link
              className={linkAccent}
              href={buildPackageQueryHref(pageBase, {
                ...query,
                baselineId: detail.baseline?.id,
                filter: detail.filter,
                page: detail.page + 1,
              })}
            >
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

export async function WorkspaceBuildPackagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; buildId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, buildId } = await params;
  return BuildPackageScreen({ productId: id, buildId, searchParams });
}

export async function StaffBuildPackagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; buildId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, buildId } = await params;
  return BuildPackageScreen({ productId: id, buildId, searchParams, staff: true });
}
