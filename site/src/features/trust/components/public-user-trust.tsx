import { Avatar, ErrorState } from "@nexus/ui";
import Link from "next/link";
import type { Locale } from "../../../lib/i18n";
import { pageShellMax4xlTight as pageShellClass } from "../../shell/page-shell";
import { panelClipSpace3P5, panelClipSpace3P6, panelClipSpace4P5 } from "../../shell/panel-shell";
import type { PublicUserTrust } from "../public-user-trust-contract";
import { trustCopy } from "../public-user-trust-copy";
import { approvalCopy } from "../public-verification-history-copy";

const actionLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
export function PublicUserTrustPanel({ data, locale }: { data: PublicUserTrust; locale: Locale }) {
  const copy = trustCopy(locale),
    profile = `/users/${encodeURIComponent(data.user.username)}`;
  const date = (value: string) =>
    new Date(value).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  return (
    <div className={pageShellClass}>
      <Link href={profile} className={actionLinkClass}>
        {copy.back}
      </Link>
      <header className={panelClipSpace3P6}>
        <Link href={`${profile}/trust/history`} className={actionLinkClass}>
          {approvalCopy(locale).title}
        </Link>
        <div className="flex min-w-0 items-center gap-3 overflow-x-clip">
          <Avatar
            src={data.user.avatarUrl ?? undefined}
            alt={data.user.displayName}
            fallback={data.user.displayName || data.user.username}
          />
          <div className="min-w-0">
            <p className="truncate font-semibold text-primary">{data.user.displayName}</p>
            <p className="truncate text-sm text-muted">@{data.user.username}</p>
          </div>
        </div>
        <h1 className="text-2xl font-extrabold text-primary">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
        <p className="text-xs text-muted">{copy.source}</p>
      </header>
      <div className="grid min-w-0 gap-4 overflow-x-clip sm:grid-cols-2">
        {(["identity", "developer"] as const).map((kind) => (
          <section key={kind} className={panelClipSpace3P5}>
            <h2 className="font-heading text-primary">{copy[kind]}</h2>
            <p
              className={
                data[kind].verified ? "text-sm font-semibold text-success" : "text-sm text-muted"
              }
            >
              {data[kind].verified ? copy.verified : copy.notVerified}
            </p>
            <p className="text-sm text-secondary">
              {copy[kind === "identity" ? "identityScope" : "developerScope"]}
            </p>
            {data[kind].verified && (
              <p className="text-xs text-muted">
                {data[kind].latestRecordedApprovalAt ? (
                  <>
                    {copy.approval}:{" "}
                    <time dateTime={data[kind].latestRecordedApprovalAt}>
                      {date(data[kind].latestRecordedApprovalAt)}
                    </time>
                  </>
                ) : (
                  copy.noDate
                )}
              </p>
            )}
          </section>
        ))}
      </div>
      <section className={panelClipSpace3P5}>
        <h2 className="font-heading text-primary">{copy.joined}</h2>
        <time className="text-sm text-secondary" dateTime={data.user.joinedAt}>
          {date(data.user.joinedAt)}
        </time>
        <p className="text-xs text-muted">{copy.joinedScope}</p>
      </section>
      <section className={panelClipSpace4P5}>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["servers", "organizations"] as const).map((kind) => (
            <div key={kind} className="min-w-0">
              <h2 className="font-heading text-primary">{copy[kind]}</h2>
              <p className="mt-2 font-numeric text-2xl font-bold text-primary">
                {data[kind].total}
              </p>
              <p className="text-sm text-muted">
                {copy.verifiedSubset}: {data[kind].verified}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">{copy.ownershipScope}</p>
      </section>
      <section className={panelClipSpace3P5}>
        <h2 className="font-heading text-primary">{copy.publications}</h2>
        {data.publications === null ? (
          <ErrorState
            id="public-user-trust-hidden-activity"
            title={copy.hiddenActivity}
            description={copy.hiddenActivityHint}
          />
        ) : (
          <>
            <p className="font-numeric text-2xl font-bold text-primary">{data.publications}</p>
            <Link href={`${profile}/activity`} className={actionLinkClass}>
              {copy.activity}
            </Link>
          </>
        )}
        <p className="text-xs text-muted">{copy.publicationScope}</p>
      </section>
      <section className={panelClipSpace3P5}>
        <h2 className="font-heading text-primary">{copy.limits}</h2>
        <p className="text-sm text-secondary">{copy.limitsDescription}</p>
        <Link href="/workspace/verification" className={actionLinkClass}>
          {copy.settings}
        </Link>
      </section>
    </div>
  );
}
