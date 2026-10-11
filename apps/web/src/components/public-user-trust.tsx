import Link from "next/link";
import { Avatar } from "@nexus/ui";
import type { Locale } from "../lib/i18n";
import type { PublicUserTrust } from "../lib/public-user-trust-contract";
import { trustCopy } from "../lib/public-user-trust-copy";
import { approvalCopy } from "../lib/public-verification-history-copy";
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
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href={profile}
        className="inline-flex min-h-11 items-center text-sm text-accent underline"
      >
        {copy.back}
      </Link>
      <header className="nexus-panel space-y-3 p-6">
        <Link
          href={`${profile}/trust/history`}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {approvalCopy(locale).title}
        </Link>
        <div className="flex items-center gap-3">
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
      <div className="grid gap-4 sm:grid-cols-2">
        {(["identity", "developer"] as const).map((kind) => (
          <section key={kind} className="nexus-panel space-y-3 p-5">
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
      <section className="nexus-panel space-y-3 p-5">
        <h2 className="font-heading text-primary">{copy.joined}</h2>
        <time className="text-sm text-secondary" dateTime={data.user.joinedAt}>
          {date(data.user.joinedAt)}
        </time>
        <p className="text-xs text-muted">{copy.joinedScope}</p>
      </section>
      <section className="nexus-panel space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {(["servers", "organizations"] as const).map((kind) => (
            <div key={kind}>
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
      <section className="nexus-panel space-y-3 p-5">
        <h2 className="font-heading text-primary">{copy.publications}</h2>
        {data.publications === null ? (
          <p className="text-sm text-muted">{copy.hiddenActivity}</p>
        ) : (
          <>
            <p className="font-numeric text-2xl font-bold text-primary">{data.publications}</p>
            <Link
              href={`${profile}/activity`}
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
            >
              {copy.activity}
            </Link>
          </>
        )}
        <p className="text-xs text-muted">{copy.publicationScope}</p>
      </section>
      <section className="nexus-panel space-y-3 p-5">
        <h2 className="font-heading text-primary">{copy.limits}</h2>
        <p className="text-sm text-secondary">{copy.limitsDescription}</p>
        <Link
          href="/workspace/verification"
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.settings}
        </Link>
      </section>
    </div>
  );
}
