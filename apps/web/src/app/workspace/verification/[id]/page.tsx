import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { VerificationApplicationAmend } from "../../../../components/verification-application-amend";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { authService } from "../../../../lib/services/auth-service";
import { verificationWorkspaceService } from "../../../../lib/services/verification-workspace-service";
import {
  verificationApplicationsCopy,
  verificationApplicationsError,
} from "../../../../lib/verification-applications-copy";
import { verificationCopy } from "../../../../lib/verification-workspace-copy";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: verificationApplicationsCopy(await getRequestLocale()).detail,
    robots: { index: false, follow: false },
  };
}
export default async function VerificationApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getRequestLocale(),
    copy = verificationApplicationsCopy(locale),
    labels = verificationCopy(locale),
    { id } = await params;
  let error = "",
    signIn = false;
  const application = await (async () => {
    try {
      const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
      if (!actor) {
        signIn = true;
        return null;
      }
      return await verificationWorkspaceService.application(actor, id);
    } catch (failure) {
      error =
        failure instanceof AppError
          ? verificationApplicationsError(locale, failure.code)
          : labels.unavailable;
      return null;
    }
  })();
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
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-primary">{copy.detail}</h1>
        <p className="mt-2 text-sm text-muted">{copy.privacy}</p>
      </header>
      <Link
        href="/workspace/verification/history"
        className="inline-flex min-h-11 items-center text-sm text-accent underline"
      >
        {copy.title}
      </Link>
      {signIn && (
        <Link
          href="/auth/login"
          className="inline-flex min-h-11 items-center text-accent underline"
        >
          {labels.signIn}
        </Link>
      )}
      {error && (
        <p role="alert" className="nexus-panel p-4 text-sm text-danger">
          {error}
        </p>
      )}
      {application && (
        <>
          <article className="nexus-panel space-y-4 p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="font-semibold text-primary">{labels[application.targetType]}</h2>
              <span className="text-sm text-secondary">{labels[application.status]}</span>
            </div>
            <p className="break-all text-xs text-muted">{application.id}</p>
            <p className="text-xs text-muted">
              {labels.submittedAt}: {time(application.createdAt)}
            </p>
            {application.resolvedAt && (
              <p className="text-xs text-muted">
                {labels.decidedAt}: {time(application.resolvedAt)}
              </p>
            )}
            <p className="whitespace-pre-wrap break-words text-sm text-secondary">
              {application.notes}
            </p>
            {application.proofUrl && (
              <a
                href={application.proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center text-sm text-accent underline"
              >
                {labels.proof}
              </a>
            )}
            {application.reviewNotes && (
              <section className="space-y-2">
                <h3 className="font-semibold text-primary">{labels.reviewNotes}</h3>
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {application.reviewNotes}
                </p>
              </section>
            )}
            {application.truncated && <p className="text-xs text-muted">{copy.truncated}</p>}
          </article>
          {application.profileState && (
            <section className="nexus-panel space-y-2 p-5">
              <p className="text-sm text-secondary">
                {
                  copy[
                    application.profileState === "changed"
                      ? "profileChanged"
                      : application.profileState
                  ]
                }
              </p>
              <Link
                href="/settings/developer"
                className="inline-flex min-h-11 items-center text-sm text-accent underline"
              >
                {labels.editProfile}
              </Link>
            </section>
          )}
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
            <p className="text-sm text-muted">{copy.readOnly}</p>
          )}
          <section className="nexus-panel space-y-4 p-5">
            <h2 className="font-semibold text-primary">{copy.events}</h2>
            {application.hasEarlierEvents && <p className="text-xs text-muted">{copy.earlier}</p>}
            {!application.events.length && <p className="text-sm text-muted">{copy.noEvents}</p>}
            <ol className="space-y-3">
              {application.events.map((event) => (
                <li key={event.id} className="flex flex-wrap justify-between gap-3 text-sm">
                  <span className="text-secondary">{eventLabels[event.action]}</span>
                  <span className="text-xs text-muted">{time(event.createdAt)}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
