import Link from "next/link";
import { cookies } from "next/headers";
import { Clock3, MailCheck, Monitor, Settings, ShieldCheck } from "lucide-react";
import { authService } from "../../lib/services/auth-service";
import { securityCenterService } from "../../lib/services/security-center-service";
import { SECURITY_ACTIVITY_LABEL_KEYS } from "../../lib/security-activity";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.securityCenter;
  const token = (await cookies()).get("nexus_session")?.value;
  const authenticated = await authService.getSessionIdentity(token);

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-20 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-accent" aria-hidden="true" />
        <h1 className="font-display text-primary">{copy.signInRequired}</h1>
        <Link
          href="/auth/login"
          className="inline-block rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)]"
        >
          {copy.signIn}
        </Link>
      </div>
    );
  }

  const { user, sessionId: currentSessionId } = authenticated;
  const [sessions, recoveryEmail, activity] = await Promise.all([
    authService.listSessions(user.id),
    authService.getRecoveryEmailStatus(user.id),
    securityCenterService.listActivity(user.id, 30),
  ]);

  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-base pb-6 sm:flex-row sm:items-start">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-primary">
            <ShieldCheck className="h-6 w-6 text-accent" aria-hidden="true" />
            {copy.title}
          </h1>
          <p className="mt-1 max-w-2xl font-caption text-muted">{copy.description}</p>
        </div>
        <Link
          href="/settings"
          className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg border border-base px-3 text-xs font-semibold text-secondary hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          {copy.manageSettings}
        </Link>
      </div>

      <section
        aria-labelledby="security-recovery-heading"
        className="nexus-panel p-5 shadow-nexus-sm"
      >
        <div className="flex items-center gap-2">
          <MailCheck className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2 id="security-recovery-heading" className="text-sm font-semibold text-primary">
            {copy.recovery}
          </h2>
        </div>
        <p className="mt-3 break-all text-sm text-primary">{recoveryEmail?.email ?? user.email}</p>
        <p className="mt-1 text-xs text-muted">
          {recoveryEmail
            ? recoveryEmail.verified
              ? copy.recoveryVerified
              : copy.recoveryNeedsVerification
            : copy.recoveryUnavailable}
        </p>
      </section>

      <section
        aria-labelledby="security-sessions-heading"
        className="nexus-panel space-y-4 p-5 shadow-nexus-sm"
      >
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2 id="security-sessions-heading" className="text-sm font-semibold text-primary">
            {copy.sessions}
          </h2>
        </div>
        <p className="text-xs text-muted">{copy.sessionsDescription}</p>
        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-base bg-inset px-3 py-3"
            >
              <div className="min-w-0">
                <p className="break-words text-xs text-primary">
                  {session.userAgent || copy.deviceUnavailable}
                </p>
                <p className="mt-1 break-words text-xs text-muted">
                  {session.ipAddress || copy.ipUnavailable}
                </p>
                <p className="mt-1 text-xs text-faint">
                  {copy.started} {new Date(session.createdAt).toLocaleString(dateLocale)}
                  {" · "}
                  {copy.expires} {new Date(session.expiresAt).toLocaleString(dateLocale)}
                </p>
              </div>
              {session.id === currentSessionId && (
                <span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent">
                  {copy.currentSession}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="security-activity-heading"
        className="nexus-panel space-y-4 p-5 shadow-nexus-sm"
      >
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2 id="security-activity-heading" className="text-sm font-semibold text-primary">
            {copy.activity}
          </h2>
        </div>
        <p className="text-xs text-muted">{copy.activityDescription}</p>

        {activity.length > 0 ? (
          <ol className="divide-y divide-base">
            {activity.map((event) => (
              <li key={event.id} className="flex flex-wrap justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">
                    {copy.activityLabels[SECURITY_ACTIVITY_LABEL_KEYS[event.action]]}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {event.userAgent || event.targetType}
                    {event.ipAddress ? ` · ${event.ipAddress}` : ""}
                  </p>
                </div>
                <time
                  dateTime={new Date(event.createdAt).toISOString()}
                  className="shrink-0 text-xs text-faint"
                >
                  {new Date(event.createdAt).toLocaleString(dateLocale)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">{copy.noActivity}</p>
        )}
      </section>
    </div>
  );
}
