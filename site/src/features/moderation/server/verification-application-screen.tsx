import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { verificationWorkspaceService } from "../../../lib/services/moderation/verification-workspace-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { PlatformSessionError } from "../../shell/session-error";
import { verificationCopy } from "../../trust/verification-workspace-copy";
import { VerificationApplicationAmend } from "../verification-amend";
import {
  verificationApplicationsCopy,
  verificationApplicationsError,
} from "../verification-applications-copy";

const pageShellClass = "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function VerificationApplicationScreen({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getRequestLocale(),
    copy = verificationApplicationsCopy(locale),
    labels = verificationCopy(locale),
    dictionary = getDictionary(locale),
    { id } = await params;
  const returnPath = `/workspace/verification/${encodeURIComponent(id)}`;
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={labels.unavailable}
        retryHref={returnPath}
      />
    );
  }
  if (!actor) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  let error = "";
  const application = await verificationWorkspaceService.application(actor, id).catch((failure) => {
    error =
      failure instanceof AppError
        ? verificationApplicationsError(locale, failure.code)
        : labels.unavailable;
    return null;
  });
  const eventLabels = {
    "verification.requested": copy.requested,
    "verification.application_updated": copy.updated,
    "verification.approved": copy.approved,
    "verification.rejected": copy.rejected,
  };
  const time = (value: string) => (
    <time dateTime={value}>
      {new Date(value).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", { timeZone: "UTC" })} UTC
    </time>
  );
  return (
    <div className={pageShellClass}>
      <header>
        <h1 className="text-2xl font-bold text-primary">{copy.detail}</h1>
        <p className="mt-2 text-sm text-muted">{copy.privacy}</p>
      </header>
      <Link href="/workspace/verification/history" className={navLinkClass}>
        {copy.title}
      </Link>
      {error ? (
        <ErrorState
          title={error}
          description={labels.unavailableHint}
          action={
            <Link href={returnPath} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      ) : null}
      {application ? (
        <>
          <article className="nexus-panel min-w-0 space-y-4 p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="min-w-0 break-words font-semibold text-primary">
                {labels[application.targetType]}
              </h2>
              <span className="text-sm text-secondary">{labels[application.status]}</span>
            </div>
            <p className="break-all text-xs text-muted">{application.id}</p>
            <p className="text-xs text-muted">
              {labels.submittedAt}: {time(application.createdAt)}
            </p>
            {application.resolvedAt ? (
              <p className="text-xs text-muted">
                {labels.decidedAt}: {time(application.resolvedAt)}
              </p>
            ) : null}
            <p className="whitespace-pre-wrap break-words text-sm text-secondary">
              {application.notes}
            </p>
            {application.proofUrl ? (
              <a
                href={application.proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={navLinkClass}
              >
                {labels.proof}
              </a>
            ) : null}
            {application.reviewNotes ? (
              <section className="space-y-2">
                <h3 className="font-semibold text-primary">{labels.reviewNotes}</h3>
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {application.reviewNotes}
                </p>
              </section>
            ) : null}
            {application.truncated ? <p className="text-xs text-muted">{copy.truncated}</p> : null}
          </article>
          {application.profileState ? (
            <section className="nexus-panel min-w-0 space-y-2 p-5">
              <p className="text-sm text-secondary">
                {
                  copy[
                    application.profileState === "changed"
                      ? "profileChanged"
                      : application.profileState
                  ]
                }
              </p>
              <Link href="/settings/developer" className={navLinkClass}>
                {labels.editProfile}
              </Link>
            </section>
          ) : null}
          {application.editable ? (
            <VerificationApplicationAmend
              key={application.revision}
              id={application.id}
              revision={application.revision}
              proofUrl={application.proofUrl}
              notes={application.notes}
              locale={locale}
            />
          ) : (
            <ErrorState
              id="verification-application-readonly"
              title={copy.readOnly}
              description={copy.readOnlyHint}
            />
          )}
          <section className="nexus-panel min-w-0 space-y-4 p-5">
            <h2 className="font-semibold text-primary">{copy.events}</h2>
            {application.hasEarlierEvents ? (
              <p className="text-xs text-muted">{copy.earlier}</p>
            ) : null}
            {!application.events.length ? (
              <EmptyState title={copy.noEvents} description={copy.noEventsHint} />
            ) : null}
            <ol className="min-w-0 space-y-3">
              {application.events.map((event) => (
                <li key={event.id} className="flex flex-wrap justify-between gap-3 text-sm">
                  <span className="text-secondary">{eventLabels[event.action]}</span>
                  <span className="text-xs text-muted">{time(event.createdAt)}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : null}
    </div>
  );
}
