"use client";

import { Button, ErrorState } from "@nexus/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  confirmedNotificationPreferences,
  type NotificationPreferences,
  parseNotificationPreferences,
} from "../lib/notification-preferences-confirmation";
import { profilePrivacyCopy } from "../lib/profile-privacy-copy";
import {
  type SettingsRecoveryEmail,
  SettingsRequestError,
  type SettingsSession,
  settingsClientRequest,
} from "../lib/settings-client-api";
import { confirmAction } from "./confirm-action";
import { ContextSwitcher } from "./context-switcher";
import { useNexusLocale } from "./locale-context";
import { PlatformSignIn } from "./platform-sign-in";
import { ProfileChangeHistoryLink } from "./private-change-history-controls";
import { PublicProfileForm } from "./public-profile-form";
import { SettingsActiveSessions } from "./settings-active-sessions";
import { SettingsNotificationPreferencesSection } from "./settings-notification-preferences-section";
import { SettingsPasswordForm } from "./settings-password-form";
import { SettingsRecoveryEmailSection } from "./settings-recovery-email-section";

type Notice = {
  text: string;
  error: boolean;
};

const pageShellClass = "mx-auto min-w-0 max-w-3xl space-y-8 overflow-x-clip";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
const retryButtonClass =
  "h-auto min-h-11 px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export function SettingsPageClient() {
  const pathname = usePathname();
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.settings;
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [sessions, setSessions] = useState<SettingsSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState(false);
  const actionInFlight = useRef(false);
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [recoveryEmail, setRecoveryEmail] = useState<SettingsRecoveryEmail | null>(null);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";

  const preferenceLabels = useMemo(
    (): Array<{
      key: keyof NotificationPreferences;
      label: string;
      description: string;
    }> => [
      {
        key: "followsEnabled",
        label: copy.newFollowers,
        description: copy.newFollowersDescription,
      },
      {
        key: "contentEnabled",
        label: copy.contentUpdates,
        description: copy.contentUpdatesDescription,
      },
      {
        key: "serverEnabled",
        label: copy.serverUpdates,
        description: copy.serverUpdatesDescription,
      },
      {
        key: "commerceEnabled",
        label: copy.resourceActivity,
        description: copy.resourceActivityDescription,
      },
      {
        key: "systemEnabled",
        label: copy.systemNotifications,
        description: copy.systemNotificationsDescription,
      },
    ],
    [copy],
  );

  function requestSettings<T>(path: string, method = "GET", body: unknown = undefined) {
    return settingsClientRequest<T>(
      path,
      method,
      body,
      copy.backendUnavailable,
      copy.unreadableResponse,
    );
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies(revision): Explicit refresh trigger; changing it must restart this request.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    setNotice(null);

    Promise.all([
      settingsClientRequest<{ preferences: NotificationPreferences }>(
        "/api/notifications/preferences",
        "GET",
        undefined,
        copy.backendUnavailable,
        copy.unreadableResponse,
      ),
      settingsClientRequest<{ sessions: SettingsSession[] }>(
        "/api/auth/sessions",
        "GET",
        undefined,
        copy.backendUnavailable,
        copy.unreadableResponse,
      ),
      settingsClientRequest<SettingsRecoveryEmail>(
        "/api/auth/email-verification",
        "GET",
        undefined,
        copy.backendUnavailable,
        copy.unreadableResponse,
      ),
    ])
      .then(([preferenceData, sessionData, recovery]) => {
        if (!active) return;
        const confirmedPreferences = parseNotificationPreferences(preferenceData.preferences);
        if (
          !confirmedPreferences ||
          !Array.isArray(sessionData.sessions) ||
          typeof recovery.email !== "string" ||
          typeof recovery.verified !== "boolean" ||
          typeof recovery.eligible !== "boolean"
        ) {
          throw new Error(copy.invalidResponse);
        }

        setPreferences(confirmedPreferences);
        setSessions(sessionData.sessions);
        setRecoveryEmail(recovery);
        setSignedOut(false);
      })
      .catch((error: unknown) => {
        if (!active) return;

        setPreferences(null);
        setSessions(null);
        setRecoveryEmail(null);
        setPassword({ currentPassword: "", newPassword: "" });
        setRecoveryPassword("");

        if (error instanceof SettingsRequestError && error.status === 401) {
          setSignedOut(true);
        } else {
          setLoadError(true);
          setNotice({ text: copy.loadFailed, error: true });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    revision,
    copy.backendUnavailable,
    copy.invalidResponse,
    copy.loadFailed,
    copy.unreadableResponse,
  ]);

  async function perform(action: () => Promise<void>) {
    if (actionInFlight.current) return;

    actionInFlight.current = true;
    setPending(true);
    setNotice(null);
    try {
      await action();
    } catch (error: unknown) {
      if (
        error instanceof SettingsRequestError &&
        error.status === 401 &&
        error.message === "Authentication required"
      ) {
        setSignedOut(true);
        setSessions(null);
        setPreferences(null);
        setRecoveryEmail(null);
        setPassword({ currentPassword: "", newPassword: "" });
        setRecoveryPassword("");
      }

      setNotice({
        error: true,
        text: error instanceof SettingsRequestError ? error.message : copy.requestUnconfirmed,
      });
    } finally {
      actionInFlight.current = false;
      setPending(false);
    }
  }

  async function refreshAfterSuccess(text: string) {
    setNotice({ text, error: false });
    try {
      const data = await requestSettings<{ sessions: SettingsSession[] }>("/api/auth/sessions");
      if (!Array.isArray(data.sessions)) {
        throw new Error(copy.invalidSessionResponse);
      }
      setSessions(data.sessions);
    } catch {
      setSessions(null);
      setNotice({
        text: `${text} ${copy.sessionRefreshFailed}`,
        error: true,
      });
    }
  }

  function requestRecoveryEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void perform(async () => {
      const data = await requestSettings<{
        accepted: boolean;
        alreadyVerified: boolean;
        expiresAt?: string;
      }>("/api/auth/email-verification", "POST", {
        currentPassword: recoveryPassword,
      });

      setRecoveryPassword("");

      if (data.alreadyVerified) {
        const refreshed = await requestSettings<SettingsRecoveryEmail>(
          "/api/auth/email-verification",
        );
        setRecoveryEmail(refreshed);
        setNotice({
          text: copy.recoveryAlreadyVerified,
          error: false,
        });
        return;
      }

      if (data.accepted !== true) {
        throw new SettingsRequestError(copy.unconfirmedVerification, 502);
      }

      setNotice({
        text: copy.verificationQueued,
        error: false,
      });
    });
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !(await confirmAction({
        title: copy.changePasswordConfirmTitle,
        object: copy.changePassword,
        consequences: copy.changePasswordConfirm,
        confirmLabel: copy.updatePassword,
        cancelLabel: copy.cancel,
        closeLabel: copy.cancel,
        danger: true,
      }))
    )
      return;
    void perform(async () => {
      const data = await requestSettings<{
        success: boolean;
        revokedSessionCount: number;
      }>("/api/auth/password", "POST", password);

      if (data.success !== true) {
        throw new SettingsRequestError(copy.unconfirmedPasswordChange, 502);
      }

      setPassword({ currentPassword: "", newPassword: "" });
      await refreshAfterSuccess(
        `${copy.passwordChanged} ${copy.otherSessionsEnded}: ${data.revokedSessionCount}. ${copy.browserRemainsSignedIn}`,
      );
    });
  }

  async function revokeSession(sessionId: string, sessionLabel: string) {
    if (
      !(await confirmAction({
        title: copy.endSessionConfirmTitle,
        object: sessionLabel,
        consequences: copy.endSessionConfirm,
        confirmLabel: copy.endSession,
        cancelLabel: copy.cancel,
        closeLabel: copy.cancel,
        danger: true,
      }))
    )
      return;
    void perform(async () => {
      const data = await requestSettings<{
        success: boolean;
        scope: string;
        sessionId: string;
      }>("/api/auth/sessions", "DELETE", { sessionId });
      if (data.success !== true || data.scope !== "single" || data.sessionId !== sessionId) {
        throw new SettingsRequestError(copy.unconfirmedSessionRevocation, 502);
      }
      await refreshAfterSuccess(copy.sessionEnded);
    });
  }

  async function revokeOthers() {
    if (
      !(await confirmAction({
        title: copy.endOtherSessionsConfirmTitle,
        object: copy.endOtherSessions,
        consequences: copy.endOtherSessionsConfirm,
        confirmLabel: copy.endOtherSessions,
        cancelLabel: copy.cancel,
        closeLabel: copy.cancel,
        danger: true,
      }))
    )
      return;
    void perform(async () => {
      const data = await requestSettings<{
        success: boolean;
        scope: string;
        revokedCount: number;
      }>("/api/auth/sessions", "DELETE", { allOther: true });

      if (
        data.success !== true ||
        data.scope !== "others" ||
        !Number.isSafeInteger(data.revokedCount) ||
        data.revokedCount < 0
      ) {
        throw new SettingsRequestError(copy.unconfirmedSessionRevocation, 502);
      }

      await refreshAfterSuccess(
        `${copy.otherSessionsEnded}: ${data.revokedCount}. ${copy.browserRemainsSignedIn}`,
      );
    });
  }

  function updatePreference(key: keyof NotificationPreferences, value: boolean) {
    void perform(async () => {
      const data = await requestSettings<{
        success: boolean;
        preferences: NotificationPreferences;
      }>("/api/notifications/preferences", "PATCH", {
        [key]: value,
      });

      const confirmedPreferences = confirmedNotificationPreferences(data);
      if (!confirmedPreferences) {
        throw new SettingsRequestError(copy.requestUnconfirmed, 502);
      }

      setPreferences(confirmedPreferences);
      setNotice({
        text: copy.preferenceSaved,
        error: false,
      });
    });
  }

  if (loading) {
    return (
      <section
        className={pageShellClass}
        aria-busy="true"
        aria-labelledby="settings-loading-heading"
      >
        <header>
          <h1 id="settings-loading-heading" className="font-display text-primary">
            {copy.title}
          </h1>
          <p role="status" aria-live="polite" className="mt-1 font-caption text-muted">
            {copy.loading}
          </p>
        </header>
        <div className="animate-pulse space-y-8" aria-hidden="true">
          {[1, 2, 3, 4].map((key) => (
            <div key={key} className="nexus-panel space-y-4 p-5 shadow-nexus-sm">
              <div className="h-4 w-1/3 rounded bg-inset" />
              <div className="h-20 rounded bg-inset" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (signedOut) {
    return <PlatformSignIn locale={locale} returnPath={pathname} />;
  }

  if (loadError) {
    return (
      <div className={`${pageShellClass} py-12`}>
        <header>
          <h1 className="font-display text-primary">{copy.unavailable}</h1>
          <p className="mt-1 font-caption text-muted">{copy.description}</p>
        </header>
        <ErrorState
          title={notice?.text ?? copy.loadFailed}
          action={
            <Button
              type="button"
              variant="ghost"
              className={retryButtonClass}
              onClick={() => setRevision((current) => current + 1)}
            >
              {copy.retry}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className={pageShellClass} aria-busy={pending || undefined}>
      <div>
        <h1 className="font-display text-primary">{copy.title}</h1>
        <p className="mt-1 font-caption text-muted">{copy.description}</p>
      </div>

      {notice?.error ? (
        <ErrorState
          id="settings-notice"
          title={notice.text}
          action={
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              className={retryButtonClass}
              onClick={() => setRevision((current) => current + 1)}
            >
              {copy.retry}
            </Button>
          }
        />
      ) : notice ? (
        <p
          id="settings-notice"
          role="status"
          aria-live="polite"
          className="rounded-md border border-base bg-surface px-4 py-3 text-sm text-primary"
        >
          {notice.text}
        </p>
      ) : null}

      {pending && (
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {copy.saving}
        </p>
      )}

      <ContextSwitcher />
      <PublicProfileForm />
      <ProfileChangeHistoryLink locale={locale} />
      <Link href="/settings/privacy" className={navLinkClass}>
        {profilePrivacyCopy(locale).title}
      </Link>

      <SettingsNotificationPreferencesSection
        copy={copy}
        preferences={preferences}
        preferenceLabels={preferenceLabels}
        pending={pending}
        onPreferenceChange={updatePreference}
      />

      <SettingsRecoveryEmailSection
        copy={copy}
        recoveryEmail={recoveryEmail}
        recoveryPassword={recoveryPassword}
        pending={pending}
        dateLocale={dateLocale}
        onRecoveryPasswordChange={setRecoveryPassword}
        onSubmit={requestRecoveryEmail}
      />

      <SettingsPasswordForm
        copy={copy}
        password={password}
        pending={pending}
        onPasswordChange={setPassword}
        onSubmit={changePassword}
      />

      <SettingsActiveSessions
        copy={copy}
        sessions={sessions}
        pending={pending}
        dateLocale={dateLocale}
        onReload={() => setRevision((current) => current + 1)}
        onRevokeOthers={revokeOthers}
        onRevokeSession={revokeSession}
      />
    </div>
  );
}
