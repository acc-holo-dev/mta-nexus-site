import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { verificationWorkspaceService } from "../../../lib/services/moderation/verification-workspace-service";
import { platformFieldClass } from "../../community/user-platform-client";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax4xl as pageShellClass } from "../../shell/page-shell";
import { panelFlexMinWrapEndP4, panelMinSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  type2xlBoldPrimary,
  typeBreakAllXsMuted,
  typeFlexWrapStartBetweenGap3,
  typeMinBreakSemiboldPrimary,
  typeMinSpace3,
  typeMinW40Flex1Space1XsMuted,
  typeMt2SmMuted,
  typePrewrapSmSecondary,
  typeSpace1XsMuted,
  typeXsMuted,
} from "../../shell/type-shell";
import {
  parseVerificationApplicationsQuery,
  verificationApplicationsHref,
} from "../../trust/verification-applications-contract";
import { VERIFICATION_TYPES } from "../../trust/verification-workspace-contract";
import { verificationCopy } from "../../trust/verification-workspace-copy";
import {
  verificationApplicationsCopy,
  verificationApplicationsError,
} from "../verification-applications-copy";

export async function verificationHistoryMetadata(): Promise<Metadata> {
  const copy = verificationApplicationsCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}

export async function VerificationHistoryScreen({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = verificationApplicationsCopy(locale),
    labels = verificationCopy(locale),
    dictionary = getDictionary(locale),
    params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {}))
    if (value !== undefined)
      for (const part of Array.isArray(value) ? value : [value]) params.append(key, part);
  const filters = parseVerificationApplicationsQuery(params);
  const historyFiltered = Boolean(
    filters?.query || filters?.status !== "all" || filters?.type !== "all",
  );
  const returnPath = params.size
    ? `/workspace/verification/history?${params}`
    : "/workspace/verification/history";
  const retryHref = filters ? returnPath : "/workspace/verification/history";
  let sessionActor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    sessionActor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.title}
        message={labels.unavailable}
        retryHref={returnPath}
      />
    );
  }
  if (!sessionActor) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  let error = filters ? "" : copy.invalid;
  const report = await (async () => {
    try {
      return filters
        ? await verificationWorkspaceService.applications(sessionActor, filters)
        : null;
    } catch (failure) {
      error =
        failure instanceof AppError
          ? verificationApplicationsError(locale, failure.code)
          : labels.unavailable;
      return null;
    }
  })();
  return (
    <div className={pageShellClass}>
      <header>
        <h1 className={type2xlBoldPrimary}>{copy.title}</h1>
        <p className={typeMt2SmMuted}>{copy.description}</p>
      </header>
      <Link href="/workspace/verification" className={linkAccentSm}>
        {labels.back}
      </Link>
      <search aria-label={copy.query}>
        <form
          method="get"
          action="/workspace/verification/history"
          className={panelFlexMinWrapEndP4}
        >
          <label className={typeMinW40Flex1Space1XsMuted}>
            {copy.query}
            <input
              type="search"
              name="q"
              maxLength={100}
              defaultValue={filters?.query ?? ""}
              className={`${platformFieldClass} block min-h-11`}
            />
          </label>
          <label className={typeSpace1XsMuted}>
            {copy.status}
            <select
              name="status"
              defaultValue={filters?.status ?? "all"}
              className={`${platformFieldClass} block min-h-11`}
            >
              {(["all", "pending", "approved", "rejected"] as const).map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? copy.all : labels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className={typeSpace1XsMuted}>
            {labels.type}
            <select
              name="type"
              defaultValue={filters?.type ?? "all"}
              className={`${platformFieldClass} block min-h-11`}
            >
              <option value="all">{copy.all}</option>
              {VERIFICATION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {labels[value]}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="min-h-11">
            {copy.search}
          </Button>
          {historyFiltered ? (
            <Link prefetch={false} href="/workspace/verification/history" className={linkAccentSm}>
              {copy.clear}
            </Link>
          ) : null}
        </form>
      </search>
      <p className={typeXsMuted}>{copy.live}</p>
      <Link
        prefetch={false}
        href={filters ? verificationApplicationsHref(filters) : "/workspace/verification/history"}
        className={linkAccentSm}
      >
        {copy.latest}
      </Link>
      {error ? (
        <ErrorState
          title={error}
          description={labels.unavailableHint}
          action={
            <Link href={retryHref} className={linkAccentSm}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      ) : null}
      {report && !report.items.length ? (
        <EmptyState
          title={historyFiltered ? copy.emptyFiltered : copy.emptyNever}
          description={historyFiltered ? copy.emptyFilteredHint : copy.emptyNeverHint}
          action={
            historyFiltered ? (
              <Link
                prefetch={false}
                href="/workspace/verification/history"
                className={linkAccentSm}
              >
                {copy.clear}
              </Link>
            ) : (
              <Link href="/workspace/verification" className={linkAccentSm}>
                {labels.back}
              </Link>
            )
          }
        />
      ) : null}
      <ul className={typeMinSpace3}>
        {report?.items.map((item) => (
          <li key={item.id}>
            <article className={panelMinSpace3P5}>
              <div className={typeFlexWrapStartBetweenGap3}>
                <h2 className={typeMinBreakSemiboldPrimary}>
                  <Link
                    prefetch={false}
                    href={`/workspace/verification/${encodeURIComponent(item.id)}`}
                  >
                    {labels[item.targetType]}
                  </Link>
                </h2>
                <span className={typeXsMuted}>{labels[item.status]}</span>
              </div>
              <p className={typePrewrapSmSecondary}>{item.notes}</p>
              <p className={typeBreakAllXsMuted}>{item.id}</p>
              <p className={typeXsMuted}>
                {labels.submittedAt}:{" "}
                <time dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </time>
              </p>
              <Link
                prefetch={false}
                href={`/workspace/verification/${encodeURIComponent(item.id)}`}
                className={linkAccentSm}
              >
                {copy.open}
              </Link>
            </article>
          </li>
        ))}
      </ul>
      {filters && report ? (
        <nav aria-label={copy.title} className="flex flex-wrap justify-between gap-4 text-sm">
          {report.newerCursor ? (
            <Link
              prefetch={false}
              className={linkAccentSm}
              href={verificationApplicationsHref(filters, report.newerCursor)}
            >
              {copy.newer}
            </Link>
          ) : null}
          {report.olderCursor ? (
            <Link
              prefetch={false}
              className={linkAccentSm}
              href={verificationApplicationsHref(filters, report.olderCursor)}
            >
              {copy.older}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
