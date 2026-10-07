"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, KeyRound, MailCheck, Monitor, ShieldCheck } from "lucide-react";
import { Button } from "@nexus/ui";
import { ContextSwitcher } from "../../components/context-switcher";
import { WebPushSettings } from "../../components/web-push-settings";
import { useNexusLocale } from "../../components/locale-context";

type Preferences = {
  followsEnabled: boolean;
  contentEnabled: boolean;
  serverEnabled: boolean;
  commerceEnabled: boolean;
  systemEnabled: boolean;
};

const preferenceKeys = [
  "followsEnabled",
  "contentEnabled",
  "serverEnabled",
  "commerceEnabled",
  "systemEnabled",
] as const;

function isPreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return preferenceKeys.every(
    (key) => typeof record[key] === "boolean",
  );
}

type Session = {
  id: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  isCurrent?: boolean;
};

type RecoveryEmail = {
  email: string;
  verified: boolean;
  verifiedAt: string | null;
  eligible: boolean;
};

type Notice = {
  text: string;
  error: boolean;
};

class SettingsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  method = "GET",
  body: unknown = undefined,
  unavailableMessage = "Account settings are temporarily unavailable.",
  unreadableMessage = "The server returned an unreadable response.",
): Promise<T> {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    credentials: "same-origin",
    signal: AbortSignal.timeout(15_000),
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new SettingsError(
      data?.error || unavailableMessage,
      response.status,
    );
  }
  if (!data) {
    throw new SettingsError(unreadableMessage, response.status);
  }
  return data as T;
}

export default function SettingsPage() {
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.settings;
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
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
  const [recoveryEmail, setRecoveryEmail] =
    useState<RecoveryEmail | null>(null);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";

  const preferenceLabels: Array<{
    key: keyof Preferences;
    label: string;
    description: string;
  }> = [
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
  ];

  function requestSettings<T>(
    path: string,
    method = "GET",
    body: unknown = undefined,
  ) {
    return request<T>(
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
      request<{ preferences: Preferences }>(
        "/api/notifications/preferences",
        "GET",
        undefined,
        copy.backendUnavailable,
        copy.unreadableResponse,
      ),
      request<{ sessions: Session[] }>(
        "/api/auth/sessions",
        "GET",
        undefined,
        copy.backendUnavailable,
        copy.unreadableResponse,
      ),
      request<RecoveryEmail>(
        "/api/auth/email-verification",
        "GET",
        undefined,
        copy.backendUnavailable,
        copy.unreadableResponse,
      ),
    ])
      .then(([preferenceData, sessionData, recovery]) => {
        if (!active) return;
        if (
          !isPreferences(preferenceData.preferences) ||
          !Array.isArray(sessionData.sessions) ||
          typeof recovery.email !== "string" ||
          typeof recovery.verified !== "boolean" ||
          typeof recovery.eligible !== "boolean"
        ) {
          throw new Error(copy.invalidResponse);
        }

        setPreferences(preferenceData.preferences);
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

        if (error instanceof SettingsError && error.status === 401) {
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
        error instanceof SettingsError &&
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
        text:
          error instanceof SettingsError
            ? error.message
            : copy.requestUnconfirmed,
      });
    } finally {
      actionInFlight.current = false;
      setPending(false);
    }
  }

  async function refreshAfterSuccess(text: string) {
    setNotice({ text, error: false });
    try {
      const data = await requestSettings<{ sessions: Session[] }>(
        "/api/auth/sessions",
      );
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
        const refreshed = await requestSettings<RecoveryEmail>(
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
        throw new SettingsError(copy.unconfirmedVerification, 502);
      }

      setNotice({
        text: copy.verificationQueued,
        error: false,
      });
    });
  }

  function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void perform(async () => {
      const data = await requestSettings<{
        success: boolean;
        revokedSessionCount: number;
      }>("/api/auth/password", "POST", password);

      if (data.success !== true) {
        throw new SettingsError(copy.unconfirmedPasswordChange, 502);
      }

      setPassword({ currentPassword: "", newPassword: "" });
      await refreshAfterSuccess(
        `${copy.passwordChanged} ${copy.otherSessionsEnded}: ${data.revokedSessionCount}. ${copy.browserRemainsSignedIn}`,
      );
    });
  }

  function revokeSession(sessionId: string) {
    void perform(async () => {
      const data = await requestSettings<{
        success: boolean;
        scope: string;
        sessionId: string;
      }>("/api/auth/sessions", "DELETE", { sessionId });
      if (data.success !== true || data.scope !== "single" || data.sessionId !== sessionId) {
        throw new SettingsError(copy.unconfirmedSessionRevocation, 502);
      }
      await refreshAfterSuccess(copy.sessionEnded);
    });
  }

  function revokeOthers() {
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
        throw new SettingsError(copy.unconfirmedSessionRevocation, 502);
      }

      await refreshAfterSuccess(
        `${copy.otherSessionsEnded}: ${data.revokedCount}. ${copy.browserRemainsSignedIn}`,
      );
    });
  }

  function updatePreference(key: keyof Preferences, value: boolean) {
    void perform(async () => {
      const data = await requestSettings<{
        success: boolean;
        preferences: Preferences;
      }>("/api/notifications/preferences", "PATCH", {
        [key]: value,
      });

      if (
        data.success !== true ||
        !isPreferences(data.preferences)
      ) {
        throw new SettingsError(copy.requestUnconfirmed, 502);
      }

      setPreferences(data.preferences);
      setNotice({
        text: copy.preferenceSaved,
        error: false,
      });
    });
  }

  if (loading) {
    return (
      <div
        role="status"
        className="py-20 text-center text-sm text-muted"
      >
        {copy.loading}
      </div>
    );
  }

  if (signedOut) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-20 text-center">
        <ShieldCheck
          className="mx-auto h-10 w-10 text-accent"
          aria-hidden="true"
        />
        <h1 className="font-display text-primary">
          {copy.signInRequired}
        </h1>
        <p className="text-sm text-muted">{copy.signInAgain}</p>
        <Link
          href="/auth/login"
          className="inline-block rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)]"
        >
          {copy.signIn}
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-20">
        <h1 className="font-display text-primary">{copy.unavailable}</h1>
        <p role="alert" className="text-sm text-muted">
          {notice?.text}
        </p>
        <Button
          type="button"
          onClick={() => setRevision((current) => current + 1)}
        >
          {copy.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-primary">{copy.title}</h1>
        <p className="mt-1 font-caption text-muted">{copy.description}</p>
      </div>

      {notice && (
        <p
          id="settings-notice"
          role={notice.error ? "alert" : "status"}
          className={`rounded-md border px-4 py-3 text-sm ${
            notice.error
              ? "border-[color:var(--nexus-danger)]/25 bg-danger-soft text-danger"
              : "border-base bg-surface text-primary"
          }`}
        >
          {notice.text}
        </p>
      )}

      {pending && (
        <p role="status" className="text-sm text-muted">
          {copy.saving}
        </p>
      )}

      <ContextSwitcher />

      <section
        aria-labelledby="notification-heading"
        className="nexus-panel space-y-4 p-5 shadow-nexus-sm"
      >
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2
            id="notification-heading"
            className="text-sm font-semibold text-primary"
          >
            {copy.notificationPreferences}
          </h2>
        </div>
        <p className="text-xs text-muted">
          {copy.notificationDescription}
        </p>
        <div className="divide-y divide-base">
          {preferences &&
            preferenceLabels.map(({ key, label, description }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between gap-4 py-3"
              >
                <span>
                  <span className="block text-sm text-primary">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {description}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={preferences[key]}
                  disabled={pending}
                  onChange={(event) =>
                    updatePreference(key, event.target.checked)
                  }
                  className="h-4 w-4 accent-[var(--nexus-accent)]"
                />
              </label>
            ))}
        </div>
        <WebPushSettings />
      </section>

      <section
        aria-labelledby="recovery-email-heading"
        className="nexus-panel space-y-4 p-5 shadow-nexus-sm"
      >
        <div className="flex items-center gap-2">
          <MailCheck className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2
            id="recovery-email-heading"
            className="text-sm font-semibold text-primary"
          >
            {copy.recoveryEmail}
          </h2>
        </div>

        {recoveryEmail && (
          <>
            <div className="rounded-md border border-base bg-inset px-3 py-3">
              <div className="break-all text-sm text-primary">
                {recoveryEmail.email}
              </div>
              <div className="mt-1 text-xs text-muted">
                {recoveryEmail.verified
                  ? `${copy.verifiedForRecovery}${
                      recoveryEmail.verifiedAt
                        ? ` ${copy.verifiedOn} ${new Date(
                            recoveryEmail.verifiedAt,
                          ).toLocaleString(dateLocale)}`
                        : ""
                    }.`
                  : recoveryEmail.eligible
                    ? copy.recoveryNotVerified
                    : copy.recoveryUnavailable}
              </div>
            </div>

            {!recoveryEmail.verified && recoveryEmail.eligible && (
              <form
                onSubmit={requestRecoveryEmail}
                aria-label={copy.verifyRecoveryEmail}
                className="space-y-3"
              >
                <p
                  id="recovery-email-policy"
                  className="text-sm text-muted"
                >
                  {copy.recoveryPolicy}
                </p>

                <div className="max-w-sm space-y-1">
                  <label
                    htmlFor="recovery-current-password"
                    className="block text-sm text-primary"
                  >
                    {copy.recoveryPassword}
                  </label>
                  <input
                    id="recovery-current-password"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    minLength={1}
                    maxLength={128}
                    disabled={pending}
                    value={recoveryPassword}
                    onChange={(event) =>
                      setRecoveryPassword(event.target.value)
                    }
                    aria-describedby="recovery-email-policy"
                    className="h-10 w-full rounded-md border border-base bg-inset px-3 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]"
                  />
                </div>

                <Button
                  type="submit"
                  size="sm"
                  isLoading={pending}
                >
                  {copy.sendVerification}
                </Button>
              </form>
            )}
          </>
        )}
      </section>

      <section
        aria-labelledby="password-heading"
        className="nexus-panel space-y-4 p-5 shadow-nexus-sm"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2
            id="password-heading"
            className="text-sm font-semibold text-primary"
          >
            {copy.changePassword}
          </h2>
        </div>

        <p id="password-policy" className="text-sm text-muted">
          {copy.passwordDescription}
        </p>

        <form
          onSubmit={changePassword}
          aria-label={copy.changePassword}
          aria-describedby="password-policy"
          className="grid gap-3 sm:grid-cols-2"
        >
          <div className="min-w-0 space-y-1">
            <label
              htmlFor="current-password"
              className="block text-sm text-primary"
            >
              {copy.currentPassword}
            </label>
            <input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              minLength={1}
              maxLength={128}
              disabled={pending}
              value={password.currentPassword}
              onChange={(event) =>
                setPassword({
                  ...password,
                  currentPassword: event.target.value,
                })
              }
              className="h-10 w-full rounded-md border border-base bg-inset px-3 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]"
            />
          </div>

          <div className="min-w-0 space-y-1">
            <label
              htmlFor="new-password"
              className="block text-sm text-primary"
            >
              {copy.newPassword}
            </label>
            <input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              disabled={pending}
              value={password.newPassword}
              onChange={(event) =>
                setPassword({
                  ...password,
                  newPassword: event.target.value,
                })
              }
              aria-describedby="password-length"
              className="h-10 w-full rounded-md border border-base bg-inset px-3 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]"
            />
            <p id="password-length" className="text-xs text-muted">
              {copy.passwordHint}
            </p>
          </div>

          <Button
            type="submit"
            size="sm"
            isLoading={pending}
            className="justify-self-start sm:col-span-2"
          >
            {copy.updatePassword}
          </Button>
        </form>
      </section>

      <section
        aria-labelledby="sessions-heading"
        className="nexus-panel space-y-4 p-5 shadow-nexus-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-accent" aria-hidden="true" />
            <h2
              id="sessions-heading"
              className="text-sm font-semibold text-primary"
            >
              {copy.activeSessions}
            </h2>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => setRevision((current) => current + 1)}
            className="text-xs font-semibold text-accent disabled:opacity-50"
          >
            {copy.reloadSettings}
          </button>
        </div>

        <p className="text-sm text-muted">{copy.sessionsDescription}</p>

        {sessions && sessions.length > 1 && (
          <button
            type="button"
            disabled={pending}
            onClick={revokeOthers}
            className="text-xs font-semibold text-danger disabled:opacity-50"
          >
            {copy.endOtherSessions}
          </button>
        )}

        <div className="space-y-2">
          {sessions?.map((session) => (
            <div
              key={session.id}
              data-session-id={session.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-base bg-inset px-3 py-2"
            >
              <div className="min-w-0">
                <div className="break-words text-xs text-primary">
                  {session.userAgent || copy.deviceUnavailable}
                </div>
                <div className="break-words text-xs text-muted">
                  {session.ipAddress || copy.ipUnavailable} / {copy.started}{" "}
                  {new Date(session.createdAt).toLocaleString(dateLocale)}
                </div>
              </div>

              {session.isCurrent ? (
                <span className="text-xs font-semibold text-accent">
                  {copy.thisBrowser}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => revokeSession(session.id)}
                  className="text-xs font-semibold text-danger disabled:opacity-50"
                >
                  {copy.endSession}
                </button>
              )}
            </div>
          ))}

          {sessions === null && (
            <p className="text-sm text-muted">
              {copy.sessionUnavailable}
            </p>
          )}

          {sessions?.length === 0 && (
            <p className="text-sm text-muted">{copy.noSessions}</p>
          )}
        </div>
      </section>
    </div>
  );
}

