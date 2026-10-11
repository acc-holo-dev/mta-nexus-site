import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { getRequestLocale } from "../lib/i18n-server";
import { getDictionary } from "../lib/i18n";
import { buildPackageCopy } from "../lib/build-package-i18n";
import { parseBuildPackageQuery, buildPackageQueryHref } from "../lib/build-package-query";
import { authService } from "../lib/services/auth-service";
import { buildPackageService } from "../lib/services/build-package-service";
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
    copy = buildPackageCopy(locale),
    dictionary = getDictionary(locale);
  const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1>{dictionary.workspace.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {dictionary.workspace.signIn}
        </Link>
      </section>
    );
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) for (const item of value) queryParams.append(key, item);
    else if (value !== undefined) queryParams.append(key, value);
  }
  const query = parseBuildPackageQuery(queryParams);
  if (!query) notFound();
  let detail: Awaited<ReturnType<typeof buildPackageService.page>>;
  try {
    detail = await buildPackageService.page(actor, productId, buildId, query, staff);
  } catch (error) {
    if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) notFound();
    throw error;
  }
  const base = `/${staff ? "admin/resources" : "workspace/resources"}/${encodeURIComponent(productId)}/builds/${encodeURIComponent(buildId)}`;
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
    <div className="space-y-6">
      <Link href={base} className="text-sm text-accent underline">
        {copy.back}
      </Link>
      <header className="space-y-2">
        <h1 className="font-display text-primary">{copy.inventory}</h1>
        <p className="text-secondary">
          {detail.product.title} · {detail.build.version}
        </p>
      </header>
      <p className="text-sm text-muted">{copy.comparisonNote}</p>
      {!detail.build.hasInventory && <p className="text-warning">{copy.legacy}</p>}
      {detail.build.hasInventory && !detail.comparisonAvailable && (
        <p className="text-warning">{copy.noBaseline}</p>
      )}
      <form
        method="get"
        action={pageBase}
        className="flex flex-wrap items-end gap-4 rounded-lg border border-base p-4"
      >
        <label className="space-y-1 text-sm">
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
        <label className="space-y-1 text-sm">
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
        <button
          type="submit"
          disabled={options.length === 0}
          className="rounded border border-base px-3 py-2 text-sm text-accent disabled:opacity-50"
        >
          {copy.apply}
        </button>
        <Link href={pageBase} className="text-sm text-accent underline">
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
          <li key={file.path} className="space-y-2 rounded-lg border border-base p-4 text-sm">
            <p className="break-words font-code">{file.path}</p>
            <p className="text-secondary">{labels[file.status]}</p>
            <dl className="grid gap-4 md:grid-cols-2">
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
        <p className="text-muted">{copy.noFiles}</p>
      )}
      {detail.totalPages > 1 && (
        <nav className="flex gap-4 text-sm" aria-label={copy.inventory}>
          {detail.page > 1 && (
            <Link
              className="text-accent underline"
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
              className="text-accent underline"
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
