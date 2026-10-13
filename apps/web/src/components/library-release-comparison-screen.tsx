import { LibraryReleaseComparisonSelection } from "./library-release-comparison-selection";
import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestLocale } from "../lib/i18n-server";
import { collectionPageParams } from "../lib/library-collections-query";
import { libraryReleaseComparisonQuery } from "../lib/library-release-comparison-query";
import { libraryReleaseComparisonCopy } from "../lib/library-release-comparison-i18n";
import { authService } from "../lib/services/auth-service";
import { libraryReleaseService } from "../lib/services/resource-release-control-service";
export async function LibraryReleaseComparisonScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, path, raw] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) notFound();
  let query: ReturnType<typeof libraryReleaseComparisonQuery>;
  try {
    query = libraryReleaseComparisonQuery(collectionPageParams(raw));
  } catch {
    notFound();
  }
  const result = await libraryReleaseService
    .compare(actor, path.id, query)
    .catch((error: unknown) => {
      if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) notFound();
      throw error;
    });
  const c = libraryReleaseComparisonCopy(locale),
    base = `/workspace/library/${encodeURIComponent(path.id)}/versions`;
  const values = { from: query.from, to: query.to, returnPage: String(query.returnPage) },
    suffix = new URLSearchParams(values).toString();
  const rows: [string, unknown, unknown][] = [
    [c.version, result.from.version, result.to.version],
    [c.published, result.from.createdAt.toISOString(), result.to.createdAt.toISOString()],
    [c.hash, result.from.sha256Hash, result.to.sha256Hash],
    [c.size, result.from.fileSizeBytes, result.to.fileSizeBytes],
    [c.fileName, result.from.fileName, result.to.fileName],
    [c.mime, result.from.mimeType, result.to.mimeType],
    [c.mta, result.from.mtaVersionTarget ?? c.unknown, result.to.mtaVersionTarget ?? c.unknown],
    [c.signed, result.from.isSigned ? c.yes : c.no, result.to.isSigned ? c.yes : c.no],
  ];
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link href={`${base}?page=${query.returnPage}`} className="text-accent underline">
        {c.back}
      </Link>
      <h1 className="font-display">{c.title}</h1>
      <h2 className="break-words">{result.product.title}</h2>
      <p className="text-secondary">{c.note}</p>
      <p role="status" className="font-semibold">
        {c[result.artifactState]}
      </p>
      <p>
        {c.delta}: {result.sizeDeltaBytes}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th scope="col">{c.field}</th>
              <th scope="col">{c.from}</th>
              <th scope="col">{c.to}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, a, b]) => (
              <tr key={label}>
                <th scope="row" className="border-b border-base p-3">
                  {label}
                </th>
                <td className="max-w-xs break-all border-b border-base p-3">{String(a)}</td>
                <td className="max-w-xs break-all border-b border-base p-3">{String(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {([result.from, result.to] as const).map((release, index) => (
          <section key={release.id} className="nexus-panel space-y-3 p-5">
            <h2>
              {index === 0 ? c.from : c.to}: {release.version}
            </h2>
            <Link
              href={`/workspace/library/${encodeURIComponent(path.id)}/requirements?${new URLSearchParams({ previewBuildId: release.id, returnFrom: index === 0 ? result.to.id : result.from.id, returnPage: String(query.returnPage) })}`}
              className="text-accent underline"
            >
              {c.preparation}
            </Link>
            <h3>{c.notes}</h3>
            <p className="whitespace-pre-wrap break-words">{release.releaseNotes ?? c.unknown}</p>
            {release.notesTruncated && <p role="note">{c.truncated}</p>}
            <h3>{c.package}</h3>
            {release.packageSummary ? (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt>{c.format}</dt>
                <dd>{release.packageSummary.format}</dd>
                <dt>{c.status}</dt>
                <dd>{c.inspectionStates[release.packageSummary.status]}</dd>
                <dt>{c.manifest}</dt>
                <dd>{c.manifestStates[release.packageSummary.manifestStatus]}</dd>
                <dt>{c.files}</dt>
                <dd>{release.packageSummary.archive?.files ?? c.unknown}</dd>
                <dt>{c.unpacked}</dt>
                <dd>{release.packageSummary.archive?.unpackedBytes ?? c.unknown}</dd>
                <dt>{c.missing}</dt>
                <dd>{release.packageSummary.missingReferences}</dd>
                <dt>{c.unresolved}</dt>
                <dd>{release.packageSummary.unresolvedReferences}</dd>
                <dt>{c.issues}</dt>
                <dd>{release.packageSummary.issueCount}</dd>
              </dl>
            ) : (
              <p>{c.unknown}</p>
            )}
          </section>
        ))}
      </div>
      <p className="text-secondary">{c.countsNote}</p>
      <LibraryReleaseComparisonSelection
        key={path.id}
        productId={path.id}
        locale={locale}
        selection={result.selection}
        target={{
          id: result.to.id,
          version: result.to.version,
          sha256Hash: result.to.sha256Hash,
          fileSizeBytes: result.to.fileSizeBytes,
        }}
      />
      <p className="text-sm">
        {c.generated}: <time dateTime={result.generatedAt}>{result.generatedAt}</time>
      </p>
      <nav className="flex flex-wrap gap-4">
        <Link
          href={`${base}/compare?${new URLSearchParams({ ...values, from: query.to, to: query.from })}`}
          className="text-accent underline"
        >
          {c.swap}
        </Link>
        <a
          href={`/api/library/releases/${encodeURIComponent(path.id)}/compare/export?${suffix}`}
          className="text-accent underline"
        >
          {c.export}
        </a>
      </nav>
    </div>
  );
}
