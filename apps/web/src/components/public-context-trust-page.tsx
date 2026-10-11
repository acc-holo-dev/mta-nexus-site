import Link from "next/link";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { getRequestLocale } from "../lib/i18n-server";
import { publicContextTrustService } from "../lib/services/public-context-trust-service";
import {
  contextTrustHref,
  parseContextTrustQuery,
  type ContextKind,
} from "../lib/public-context-trust-contract";
import { contextTrustCopy, contextTrustError } from "../lib/public-context-trust-copy";
import { approvalCopy } from "../lib/public-verification-history-copy";
export type ContextTrustPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
export async function contextTrustMetadata(kind: ContextKind, props: ContextTrustPageProps) {
  const { slug } = await props.params,
    copy = contextTrustCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: contextTrustHref(kind, slug) },
  };
}
export async function PublicContextTrustPage({
  kind,
  params,
  searchParams,
}: ContextTrustPageProps & { kind: ContextKind }) {
  const { slug } = await params,
    locale = await getRequestLocale(),
    copy = contextTrustCopy(locale),
    approvals = approvalCopy(locale),
    query = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (Array.isArray(value)) for (const part of value) query.append(key, part);
    else if (value !== undefined) query.append(key, value);
  }
  const filters = parseContextTrustQuery(query),
    latest = contextTrustHref(kind, slug);
  let error = filters ? "" : approvals.invalid;
  const page = filters
    ? await publicContextTrustService.page(kind, slug, filters).catch((failure: unknown) => {
        if (failure instanceof AppError && failure.code === "NOT_FOUND") notFound();
        error = contextTrustError(
          locale,
          failure instanceof AppError ? failure.code : "INTERNAL_ERROR",
        );
        return null;
      })
    : null;
  const base = `/${kind === "organization" ? "organizations" : "servers"}/${encodeURIComponent(slug)}`;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={base} className="inline-flex min-h-11 items-center text-sm text-accent underline">
        {copy.back}
      </Link>
      <header className="nexus-panel space-y-3 p-6">
        <h1 className="text-2xl font-extrabold text-primary">{copy.title}</h1>
        {page && <p className="break-words font-semibold text-primary">{page.subject.name}</p>}
        <p className="text-sm text-muted">{copy.description}</p>
        <p className="text-sm text-secondary">
          {kind === "organization" ? copy.organizationScope : copy.serverScope}
        </p>
      </header>
      {page && (
        <section className="nexus-panel space-y-4 p-5">
          <h2 className="font-heading text-primary">{copy.current}</h2>
          <p
            className={`text-sm font-semibold ${page.subject.verified ? "text-success" : "text-muted"}`}
          >
            {page.subject.verified ? copy.verified : copy.unverified}
          </p>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">{copy.created}</dt>
              <dd className="text-sm text-primary">
                <time dateTime={page.subject.createdAt}>
                  {new Date(page.subject.createdAt).toLocaleDateString(
                    locale === "ru" ? "ru-RU" : "en-US",
                    { timeZone: "UTC" },
                  )}
                </time>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{copy.publications}</dt>
              <dd className="text-sm text-primary">{page.subject.publications}</dd>
            </div>
            {page.subject.servers && (
              <>
                <div>
                  <dt className="text-xs text-muted">{copy.servers}</dt>
                  <dd className="text-sm text-primary">{page.subject.servers.total}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{copy.verifiedServers}</dt>
                  <dd className="text-sm text-primary">{page.subject.servers.verified}</dd>
                </div>
              </>
            )}
            {page.subject.ownershipKind && (
              <div>
                <dt className="text-xs text-muted">{copy.ownership}</dt>
                <dd className="text-sm text-primary">{copy[page.subject.ownershipKind]}</dd>
              </div>
            )}
            {page.subject.organization && (
              <div>
                <dt className="text-xs text-muted">{copy.affiliation}</dt>
                <dd>
                  <Link
                    href={contextTrustHref("organization", page.subject.organization.slug)}
                    className="break-words text-sm text-accent underline"
                  >
                    {page.subject.organization.name}
                  </Link>
                  <p className="text-xs text-muted">
                    {page.subject.organization.verified ? copy.verified : copy.unverified}
                  </p>
                </dd>
              </div>
            )}
          </dl>
          <Link
            href={`${base}/${kind === "organization" ? "activity" : "updates"}`}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.activity}
          </Link>
        </section>
      )}
      <section className="space-y-4">
        <h2 className="font-heading text-primary">{copy.history}</h2>
        <p className="text-sm text-muted">{approvals.scope}</p>
        <a
          href={latest}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.latest}
        </a>
        {error && (
          <p role="alert" className="nexus-panel p-4 text-sm text-danger">
            {error}
          </p>
        )}
        {page && !page.items.length && (
          <p className="nexus-panel p-5 text-sm text-muted">{copy.empty}</p>
        )}
        {page && (
          <ol className="space-y-3">
            {page.items.map((record) => (
              <li key={record.key} className="nexus-panel space-y-2 p-5">
                <p className="text-sm text-secondary">{copy.approved}</p>
                <time dateTime={record.approvedAt} className="text-sm text-muted">
                  {new Date(record.approvedAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                    timeZone: "UTC",
                    timeZoneName: "short",
                  })}
                </time>
              </li>
            ))}
          </ol>
        )}
        {page?.nextCursor && (
          <Link
            prefetch={false}
            href={contextTrustHref(kind, slug, page.nextCursor)}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.older}
          </Link>
        )}
      </section>
    </div>
  );
}
