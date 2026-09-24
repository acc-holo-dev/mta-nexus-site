"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ContextSwitcher } from "../../components/context-switcher";
import { Bell, KeyRound, MailCheck, Monitor, ShieldCheck } from "lucide-react";

type Preferences = {
  followsEnabled: boolean;
  contentEnabled: boolean;
  serverEnabled: boolean;
  commerceEnabled: boolean;
  systemEnabled: boolean;
};
type Session = {
  id: string; expiresAt: string; ipAddress?: string; userAgent?: string;
  createdAt: string; isCurrent?: boolean;
};
type RecoveryEmail = {
  email: string;
  verified: boolean;
  verifiedAt: string | null;
  eligible: boolean;
};
type Notice = { text: string; error: boolean };
class SettingsError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method, cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(15_000),
    ...(body === undefined ? {} : {
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new SettingsError(data?.error || "Account settings are temporarily unavailable.", response.status);
  }
  if (!data) throw new SettingsError("The server returned an unreadable response.", response.status);
  return data as T;
}
const preferenceLabels: Array<{ key: keyof Preferences; label: string; description: string }> = [
  { key: "followsEnabled", label: "New followers", description: "When another player follows your activity." },
  { key: "contentEnabled", label: "Content updates", description: "News, articles and creator updates." },
  { key: "serverEnabled", label: "Server updates", description: "Updates related to followed MTA servers." },
  { key: "commerceEnabled", label: "Resource activity", description: "Claims, licenses and resource delivery events." },
  { key: "systemEnabled", label: "System notifications", description: "Important non-security account messages." },
];

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState(false);
  const actionInFlight = useRef(false);
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "" });
  const [recoveryEmail, setRecoveryEmail] = useState<RecoveryEmail | null>(null);
  const [recoveryPassword, setRecoveryPassword] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    setNotice(null);
    Promise.all([
      request<{ preferences: Preferences }>("/api/notifications/preferences"),
      request<{ sessions: Session[] }>("/api/auth/sessions"),
      request<RecoveryEmail>("/api/auth/email-verification"),
    ]).then(([p, s, recovery]) => {
      if (!active) return;
      if (!p.preferences || !Array.isArray(s.sessions)
        || typeof recovery.email !== "string" || typeof recovery.verified !== "boolean"
        || typeof recovery.eligible !== "boolean") throw new Error("Invalid settings response");
      setPreferences(p.preferences);
      setSessions(s.sessions);
      setRecoveryEmail(recovery);
      setSignedOut(false);
    }).catch((error: unknown) => {
      if (!active) return;
      setPreferences(null);
      setSessions(null);
      setRecoveryEmail(null);
      setPassword({ currentPassword: "", newPassword: "" });
      setRecoveryPassword("");
      if (error instanceof SettingsError && error.status === 401) setSignedOut(true);
      else {
        setLoadError(true);
        setNotice({ text: "Could not load account settings. Your sign-in status has not been confirmed.", error: true });
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  const perform = async (action: () => Promise<void>) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setPending(true);
    setNotice(null);
    try { await action(); }
    catch (error: unknown) {
      if (error instanceof SettingsError && error.status === 401 && error.message === "Authentication required") {
        setSignedOut(true);
        setSessions(null);
        setPreferences(null);
        setRecoveryEmail(null);
        setPassword({ currentPassword: "", newPassword: "" });
        setRecoveryPassword("");
      }
      setNotice({ error: true, text: error instanceof SettingsError ? error.message
        : "The request could not be confirmed. Reload settings before retrying." });
    } finally {
      actionInFlight.current = false;
      setPending(false);
    }
  };

  const refreshAfterSuccess = async (text: string) => {
    // A subsequent list-read failure must not erase an already-confirmed mutation.
    setNotice({ text, error: false });
    try {
      const data = await request<{ sessions: Session[] }>("/api/auth/sessions");
      if (!Array.isArray(data.sessions)) throw new Error("Invalid session response");
      setSessions(data.sessions);
    } catch {
      setSessions(null);
      setNotice({ text: `${text} The session list could not be refreshed. Reload settings to check it.`, error: true });
    }
  };

  const requestRecoveryEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void perform(async () => {
      const data = await request<{ accepted: boolean; alreadyVerified: boolean; expiresAt?: string }>(
        "/api/auth/email-verification", "POST", { currentPassword: recoveryPassword },
      );
      setRecoveryPassword("");
      if (data.alreadyVerified) {
        const refreshed = await request<RecoveryEmail>("/api/auth/email-verification");
        setRecoveryEmail(refreshed);
        setNotice({ text: "This recovery email is already verified.", error: false });
        return;
      }
      if (data.accepted !== true) throw new Error("Unconfirmed email verification request");
      setNotice({
        text: "Verification email queued. Open the link in that email while this sign-in is still active.",
        error: false,
      });
    });
  };

  const changePassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void perform(async () => {
      const data = await request<{ success: boolean; revokedSessionCount: number }>("/api/auth/password", "POST", password);
      if (data.success !== true) throw new Error("Unconfirmed password change");
      setPassword({ currentPassword: "", newPassword: "" });
      await refreshAfterSuccess(`Password changed. Other sessions ended: ${data.revokedSessionCount}. This browser remains signed in.`);
    });
  };
  const revokeSession = (sessionId: string) => void perform(async () => {
    const data = await request<{ success: boolean }>("/api/auth/sessions", "DELETE", { sessionId });
    if (data.success !== true) throw new Error("Unconfirmed session revocation");
    await refreshAfterSuccess("Session ended. That sign-in can no longer access your account.");
  });
  const revokeOthers = () => void perform(async () => {
    const data = await request<{ success: boolean; revokedCount: number }>("/api/auth/sessions", "DELETE", { allOther: true });
    if (data.success !== true) throw new Error("Unconfirmed session revocation");
    await refreshAfterSuccess(`Other sessions ended: ${data.revokedCount}. This browser remains signed in.`);
  });
  const updatePreference = (key: keyof Preferences, value: boolean) => void perform(async () => {
    await request("/api/notifications/preferences", "PATCH", { [key]: value });
    setPreferences((previous) => previous ? { ...previous, [key]: value } : previous);
    setNotice({ text: "Notification preference saved.", error: false });
  });

  if (loading) return <div role="status" className="py-20 text-center text-sm text-muted">Loading account settings...</div>;
  if (signedOut) return (
    <div className="max-w-md mx-auto py-20 text-center space-y-4">
      <ShieldCheck className="w-10 h-10 mx-auto text-accent" aria-hidden="true" />
      <h1 className="font-display text-primary">Sign in required</h1>
      <p className="text-sm text-muted">Sign in again to manage your account security.</p>
      <Link href="/auth/login" className="inline-block px-4 py-2 rounded-md bg-accent text-white text-xs font-semibold">Sign in</Link>
    </div>
  );
  if (loadError) return (
    <div className="max-w-md mx-auto py-20 space-y-4">
      <h1 className="font-display text-primary">Account settings unavailable</h1>
      <p role="alert" className="text-sm text-muted">{notice?.text}</p>
      <button onClick={() => setRevision((r) => r + 1)} className="px-4 py-2 rounded-md bg-accent text-white">Try again</button>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-primary">Settings</h1>
        <p className="font-caption text-muted mt-1">Control notifications and protect your account.</p>
      </div>
      {notice && <p id="settings-notice" role={notice.error ? "alert" : "status"} className="rounded-md border border-base bg-surface px-4 py-3 text-sm text-primary">{notice.text}</p>}
      {pending && <p role="status" className="text-sm text-muted">Saving account changes...</p>}
      <ContextSwitcher />
      <section aria-labelledby="notification-heading" className="nexus-panel p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-accent" aria-hidden="true" />
          <h2 id="notification-heading" className="text-sm font-semibold text-primary">Notification preferences</h2>
        </div>
        <p className="text-xs text-muted">These preferences do not control security-related messages.</p>
        <div className="divide-y divide-base">
          {preferences && preferenceLabels.map(({ key, label, description }) => (
            <label key={key} className="flex items-center justify-between gap-4 py-3 cursor-pointer">
              <span><span className="block text-sm text-primary">{label}</span><span className="block text-xs text-muted mt-0.5">{description}</span></span>
              <input type="checkbox" checked={preferences[key]} disabled={pending}
                onChange={(event) => updatePreference(key, event.target.checked)} className="h-4 w-4 accent-[var(--nexus-accent)]" />
            </label>
          ))}
        </div>
      </section>
      <section aria-labelledby="recovery-email-heading" className="nexus-panel p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MailCheck className="w-4 h-4 text-accent" aria-hidden="true" />
          <h2 id="recovery-email-heading" className="text-sm font-semibold text-primary">Recovery email</h2>
        </div>
        {recoveryEmail && (
          <>
            <div className="rounded-md border border-base bg-inset px-3 py-3">
              <div className="text-sm text-primary break-all">{recoveryEmail.email}</div>
              <div className="mt-1 text-xs text-muted">
                {recoveryEmail.verified
                  ? `Verified for recovery${recoveryEmail.verifiedAt ? ` on ${new Date(recoveryEmail.verifiedAt).toLocaleString()}` : ""}.`
                  : recoveryEmail.eligible
                    ? "Not verified for recovery yet."
                    : "Recovery email verification is unavailable for this account."}
              </div>
            </div>
            {!recoveryEmail.verified && recoveryEmail.eligible && (
              <form onSubmit={requestRecoveryEmail} aria-label="Verify recovery email" className="space-y-3">
                <p id="recovery-email-policy" className="text-sm text-muted">
                  Enter your current password. We will queue a confirmation link for the email already stored on this account.
                </p>
                <div className="max-w-sm space-y-1">
                  <label htmlFor="recovery-current-password" className="block text-sm text-primary">Current password</label>
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
                    onChange={(event) => setRecoveryPassword(event.target.value)}
                    aria-describedby="recovery-email-policy"
                    className="w-full h-10 rounded-md bg-inset border border-base px-3 text-sm text-primary"
                  />
                </div>
                <button type="submit" disabled={pending}
                  className="px-4 py-2 rounded-md bg-accent text-white text-xs font-semibold disabled:opacity-50">
                  Send verification email
                </button>
              </form>
            )}
          </>
        )}
      </section>
      <section aria-labelledby="password-heading" className="nexus-panel p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-accent" aria-hidden="true" />
          <h2 id="password-heading" className="text-sm font-semibold text-primary">Change password</h2>
        </div>
        <p id="password-policy" className="text-sm text-muted">Enter your current password. Changing it ends all other sessions and renews this browser's sign-in token.</p>
        <form onSubmit={changePassword} aria-label="Change password" aria-describedby="password-policy" className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0 space-y-1">
            <label htmlFor="current-password" className="block text-sm text-primary">Current password</label>
            <input id="current-password" name="currentPassword" type="password" autoComplete="current-password"
              required minLength={1} maxLength={128} disabled={pending} value={password.currentPassword}
              onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })}
              className="w-full h-10 rounded-md bg-inset border border-base px-3 text-sm text-primary" />
          </div>
          <div className="min-w-0 space-y-1">
            <label htmlFor="new-password" className="block text-sm text-primary">New password</label>
            <input id="new-password" name="newPassword" type="password" autoComplete="new-password"
              required minLength={8} maxLength={128} disabled={pending} value={password.newPassword}
              onChange={(event) => setPassword({ ...password, newPassword: event.target.value })}
              aria-describedby="password-length" className="w-full h-10 rounded-md bg-inset border border-base px-3 text-sm text-primary" />
            <p id="password-length" className="text-xs text-muted">8 to 128 characters; different from your current password.</p>
          </div>
          <button type="submit" disabled={pending} className="sm:col-span-2 justify-self-start px-4 py-2 rounded-md bg-accent text-white text-xs font-semibold disabled:opacity-50">Update password</button>
        </form>
      </section>
      <section aria-labelledby="sessions-heading" className="nexus-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-accent" aria-hidden="true" />
            <h2 id="sessions-heading" className="text-sm font-semibold text-primary">Active sessions</h2>
          </div>
          <button disabled={pending} onClick={() => setRevision((r) => r + 1)} className="text-xs font-semibold text-accent disabled:opacity-50">Reload settings</button>
        </div>
        <p className="text-sm text-muted">End an unfamiliar session to remove its access. This browser stays signed in; use Sign out in the header to leave it.</p>
        {sessions && sessions.length > 1 && <button disabled={pending} onClick={revokeOthers} className="text-xs font-semibold text-danger disabled:opacity-50">End other sessions</button>}
        <div className="space-y-2">
          {sessions?.map((session) => (
            <div key={session.id} data-session-id={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-base px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs text-primary break-words">{session.userAgent || "Device details unavailable"}</div>
                <div className="text-xs text-muted break-words">{session.ipAddress || "IP unavailable"} / Started {new Date(session.createdAt).toLocaleString()}</div>
              </div>
              {session.isCurrent ? <span className="text-xs text-accent font-semibold">This browser</span>
                : <button disabled={pending} onClick={() => revokeSession(session.id)} className="text-xs text-danger disabled:opacity-50">End session</button>}
            </div>
          ))}
          {sessions === null && <p className="text-sm text-muted">The session list is unavailable. Reload settings to check it.</p>}
          {sessions?.length === 0 && <p className="text-sm text-muted">No active sessions found. Reload settings to confirm your sign-in.</p>}
        </div>
      </section>
    </div>
  );
}
