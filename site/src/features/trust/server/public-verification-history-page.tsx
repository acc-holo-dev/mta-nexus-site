import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState, fieldClass } from "@nexus/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { publicVerificationHistoryService } from "../../../lib/services/trust/public-verification-history-service";
import { linkAccentSm, linkSecondaryBorder } from "../../shell/link-shell";
import { pageShellMax4xlTight as pageShellClass, pageShellStack3 } from "../../shell/page-shell";
import { panelClipSpace2P5, panelClipSpace3P5, panelClipSpace3P6 } from "../../shell/panel-shell";
import {
  type2xlExtraboldPrimary,
  typeBreakSemiboldPrimary,
  typeGrid2Gap4,
  typeHeadingPrimary,
  typeSemiboldPrimary,
  typeSmSecondary,
  typeSpace1XsMuted,
} from "../../shell/type-shell";
import { approvalPageHref, parseApprovalQuery } from "../public-verification-history-contract";
import { approvalCopy, approvalError } from "../public-verification-history-copy";

export async function approvalHistoryMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const copy = approvalCopy(await getRequestLocale()),
    { username } = await params;
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: approvalPageHref(username) },
  };
}

export async function ApprovalHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await params,
    locale = await getRequestLocale(),
    copy = approvalCopy(locale),
    dictionary = getDictionary(locale),
    query = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (Array.isArray(value)) for (const part of value) query.append(key, part);
    else if (value !== undefined) query.append(key, value);
  }
  const filters = parseApprovalQuery(query),
    latest = approvalPageHref(username, filters ?? {}),
    filtered = Boolean(filters?.type);
  let error = filters ? "" : copy.invalid;
  const page = filters
    ? await publicVerificationHistoryService.page(username, filters).catch((failure: unknown) => {
        if (failure instanceof AppError && failure.code === "NOT_FOUND") notFound();
        error = approvalError(
          locale,
          failure instanceof AppError ? failure.code : "INTERNAL_ERROR",
        );
        return null;
      })
    : null;
  return (
    <div className={pageShellClass}>
      <Link href={`/users/${encodeURIComponent(username)}/trust`} className={linkAccentSm}>
        {copy.back}
      </Link>
      <header className={panelClipSpace3P6}>
        <h1 className={type2xlExtraboldPrimary}>{copy.title}</h1>
        {page && (
          <p className={typeBreakSemiboldPrimary}>
            {page.subject.name} (@{page.subject.username})
          </p>
        )}
        <p className="text-sm text-muted">{copy.description}</p>
        <p className={typeSmSecondary}>{copy.scope}</p>
      </header>
      {page && (
        <section className={panelClipSpace3P5}>
          <h2 className={typeHeadingPrimary}>{copy.current}</h2>
          <dl className={typeGrid2Gap4}>
            <div>
              <dt className="text-sm text-muted">{copy.user}</dt>
              <dd
                className={`text-sm font-semibold ${page.subject.identityVerified ? "text-success" : "text-muted"}`}
              >
                {page.subject.identityVerified ? copy.verified : copy.unverified}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">{copy.developer}</dt>
              <dd
                className={`text-sm font-semibold ${page.subject.developerVerified ? "text-success" : "text-muted"}`}
              >
                {page.subject.developerVerified ? copy.verified : copy.unverified}
              </dd>
            </div>
          </dl>
        </section>
      )}
      <form
        action={approvalPageHref(username)}
        method="get"
        className="nexus-panel flex min-w-0 flex-wrap items-end gap-3 overflow-x-clip p-4"
      >
        <label className={typeSpace1XsMuted}>
          {copy.type}
          <select
            name="type"
            defaultValue={filters?.type ?? ""}
            className={`${fieldClass} block min-h-11`}
          >
            <option value="">{copy.all}</option>
            <option value="user">{copy.user}</option>
            <option value="developer">{copy.developer}</option>
          </select>
        </label>
        <Button type="submit" className="min-h-11 font-semibold">
          {copy.filter}
        </Button>
        <Link href={approvalPageHref(username)} className={linkAccentSm}>
          {copy.reset}
        </Link>
      </form>
      <a href={latest} className={linkAccentSm}>
        {copy.latest}
      </a>
      {error && (
        <ErrorState
          title={error}
          description={copy.unavailableHint}
          action={
            <a href={latest} className={linkAccentSm}>
              {dictionary.errors.retry}
            </a>
          }
        />
      )}
      {page && !page.items.length && (
        <EmptyState
          title={filtered ? copy.emptyFiltered : copy.empty}
          description={filtered ? copy.emptyFilteredHint : copy.emptyHint}
          action={
            filtered ? (
              <Link href={approvalPageHref(username)} className={linkAccentSm}>
                {copy.reset}
              </Link>
            ) : undefined
          }
        />
      )}
      {page && (
        <ol className={pageShellStack3}>
          {page.items.map((record) => (
            <li key={record.key} className={panelClipSpace2P5}>
              <h2 className={typeSemiboldPrimary}>{copy[record.type]}</h2>
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
      {page?.nextCursor && filters && (
        <Link
          prefetch={false}
          href={approvalPageHref(username, filters, page.nextCursor)}
          className={linkSecondaryBorder}
        >
          {copy.older}
        </Link>
      )}
    </div>
  );
}
