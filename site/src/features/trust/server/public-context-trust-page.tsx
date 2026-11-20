import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { publicContextTrustService } from "../../../lib/services/trust/public-context-trust-service";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax4xlTight as pageShellClass, pageShellStack4 } from "../../shell/page-shell";
import { panelClipSpace2P5, panelClipSpace3P6, panelClipSpace4P5 } from "../../shell/panel-shell";
import {
  type2xlExtraboldPrimary,
  typeBreakSemiboldPrimary,
  typeGrid2Gap4,
  typeHeadingPrimary,
  typeSmPrimary,
  typeSmSecondary,
} from "../../shell/type-shell";
import {
  type ContextKind,
  contextTrustHref,
  parseContextTrustQuery,
} from "../public-context-trust-contract";
import { contextTrustCopy, contextTrustError } from "../public-context-trust-copy";
import { approvalCopy } from "../public-verification-history-copy";
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
    dictionary = getDictionary(locale),
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
    <div className={pageShellClass}>
      <Link href={base} className={linkAccentSm}>
        {copy.back}
      </Link>
      <header className={panelClipSpace3P6}>
        <h1 className={type2xlExtraboldPrimary}>{copy.title}</h1>
        {page && <p className={typeBreakSemiboldPrimary}>{page.subject.name}</p>}
        <p className="text-sm text-muted">{copy.description}</p>
        <p className={typeSmSecondary}>
          {kind === "organization" ? copy.organizationScope : copy.serverScope}
        </p>
      </header>
      {page && (
        <section className={panelClipSpace4P5}>
          <h2 className={typeHeadingPrimary}>{copy.current}</h2>
          <p
            className={`text-sm font-semibold ${page.subject.verified ? "text-success" : "text-muted"}`}
          >
            {page.subject.verified ? copy.verified : copy.unverified}
          </p>
          <dl className={typeGrid2Gap4}>
            <div>
              <dt className="text-xs text-muted">{copy.created}</dt>
              <dd className={typeSmPrimary}>
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
              <dd className={typeSmPrimary}>{page.subject.publications}</dd>
            </div>
            {page.subject.servers && (
              <>
                <div>
                  <dt className="text-xs text-muted">{copy.servers}</dt>
                  <dd className={typeSmPrimary}>{page.subject.servers.total}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{copy.verifiedServers}</dt>
                  <dd className={typeSmPrimary}>{page.subject.servers.verified}</dd>
                </div>
              </>
            )}
            {page.subject.ownershipKind && (
              <div>
                <dt className="text-xs text-muted">{copy.ownership}</dt>
                <dd className={typeSmPrimary}>{copy[page.subject.ownershipKind]}</dd>
              </div>
            )}
            {page.subject.organization && (
              <div>
                <dt className="text-xs text-muted">{copy.affiliation}</dt>
                <dd>
                  <Link
                    href={contextTrustHref("organization", page.subject.organization.slug)}
                    className="break-words text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
            className={linkAccentSm}
          >
            {copy.activity}
          </Link>
        </section>
      )}
      <section className={pageShellStack4}>
        <h2 className={typeHeadingPrimary}>{copy.history}</h2>
        <p className="text-sm text-muted">{approvals.scope}</p>
        <a href={latest} className={linkAccentSm}>
          {copy.latest}
        </a>
        {error && (
          <ErrorState
            title={error}
            description={approvals.unavailableHint}
            action={
              <a href={latest} className={linkAccentSm}>
                {dictionary.errors.retry}
              </a>
            }
          />
        )}
        {page && !page.items.length && (
          <EmptyState title={copy.empty} description={copy.emptyHint} />
        )}
        {page && (
          <ol className="space-y-3">
            {page.items.map((record) => (
              <li key={record.key} className={panelClipSpace2P5}>
                <p className={typeSmSecondary}>{copy.approved}</p>
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
            className={linkAccentSm}
          >
            {copy.older}
          </Link>
        )}
      </section>
    </div>
  );
}

export const serverContextTrustMetadata = (props: ContextTrustPageProps) =>
  contextTrustMetadata("server", props);

export function ServerContextTrustPage(props: ContextTrustPageProps) {
  return PublicContextTrustPage({ ...props, kind: "server" });
}
