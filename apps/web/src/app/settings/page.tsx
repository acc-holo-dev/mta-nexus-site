"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, KeyRound, Monitor, ShieldCheck, Trash2 } from "lucide-react";

type Preferences = {
  followsEnabled: boolean;
  contentEnabled: boolean;
  serverEnabled: boolean;
  commerceEnabled: boolean;
  systemEnabled: boolean;
};

type Session = {
  id: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
};

const preferenceLabels: Array<{ key: keyof Preferences; label: string; description: string }> = [
  { key: "followsEnabled", label: "New followers", description: "When another player follows your activity." },
  { key: "contentEnabled", label: "Content updates", description: "News, articles and creator updates." },
  { key: "serverEnabled", label: "Server updates", description: "Updates related to followed MTA servers." },
  { key: "commerceEnabled", label: "Resource activity", description: "Claims, licenses and resource delivery events." },
  { key: "systemEnabled", label: "System notifications", description: "Important non-security account messages." },
];

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "" });

  useEffect(() => {
    Promise.all([
      fetch("/api/notifications/preferences").then((response) => response.json()),
      fetch("/api/auth/sessions").then((response) => response.json()),
    ])
      .then(([preferenceData, sessionData]) => {
        if (preferenceData.error || sessionData.error) {
          setSignedOut(true);
          return;
        }
        setPreferences(preferenceData.preferences);
        setSessions(sessionData.sessions || []);
      })
      .catch(() => setMessage("Could not load account settings."))
      .finally(() => setLoading(false));
  }, []);

  const updatePreference = async (key: keyof Preferences, value: boolean) => {
    if (!preferences) return;
    const previous = preferences[key];
    setPreferences({ ...preferences, [key]: value });
    const response = await fetch("/api/notifications/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (!response.ok) {
      setPreferences({ ...preferences, [key]: previous });
      setMessage("Could not save this preference.");
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(password),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Could not change password.");
      return;
    }
    setPassword({ currentPassword: "", newPassword: "" });
    setMessage(`Password changed. Revoked ${data.revokedSessionCount} other session(s).`);
    const refreshed = await fetch("/api/auth/sessions");
    const refreshedData = await refreshed.json();
    setSessions(refreshedData.sessions || []);
  };

  const revokeSession = async (sessionId: string) => {
    const response = await fetch("/api/auth/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (response.ok) {
      setSessions(sessions.filter((session) => session.id !== sessionId));
      setMessage("Session revoked.");
    } else {
      setMessage("Could not revoke that session.");
    }
  };

  const revokeOthers = async () => {
    const response = await fetch("/api/auth/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allOther: true }),
    });
    const data = await response.json();
    if (response.ok) {
      setSessions(sessions.slice(0, 1));
      setMessage(`Revoked ${data.revokedCount} other session(s).`);
    } else {
      setMessage(data.error || "Could not revoke other sessions.");
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-sm text-muted">Loading account settings…</div>;
  }

  if (signedOut) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <ShieldCheck className="w-10 h-10 mx-auto text-accent" />
        <h1 className="font-display text-primary">Sign in required</h1>
        <Link href="/auth/login" className="inline-block px-4 py-2 rounded-md bg-accent text-white text-xs font-semibold">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-primary">Settings</h1>
        <p className="font-caption text-muted mt-1">Control notifications and protect your account.</p>
      </div>

      {message && <div className="rounded-md border border-base bg-surface px-4 py-3 text-sm text-secondary">{message}</div>}

      <section className="nexus-panel p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-primary">Notification preferences</h2>
        </div>
        <p className="text-xs text-muted">Security notifications are always delivered.</p>
        <div className="divide-y divide-base">
          {preferences && preferenceLabels.map(({ key, label, description }) => (
            <label key={key} className="flex items-center justify-between gap-4 py-3 cursor-pointer">
              <span>
                <span className="block text-sm text-primary">{label}</span>
                <span className="block text-xs text-muted mt-0.5">{description}</span>
              </span>
              <input
                type="checkbox"
                checked={preferences[key]}
                onChange={(event) => updatePreference(key, event.target.checked)}
                className="h-4 w-4 accent-[var(--nexus-accent)]"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="nexus-panel p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-primary">Change password</h2>
        </div>
        <form onSubmit={changePassword} className="grid gap-3 sm:grid-cols-2">
          <input
            type="password"
            required
            minLength={1}
            value={password.currentPassword}
            onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })}
            placeholder="Current password"
            className="h-10 rounded-md bg-inset border border-base px-3 text-sm text-primary"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password.newPassword}
            onChange={(event) => setPassword({ ...password, newPassword: event.target.value })}
            placeholder="New password (8+ characters)"
            className="h-10 rounded-md bg-inset border border-base px-3 text-sm text-primary"
          />
          <button type="submit" className="sm:col-span-2 justify-self-start px-4 py-2 rounded-md bg-accent text-white text-xs font-semibold">
            Update password
          </button>
        </form>
      </section>

      <section className="nexus-panel p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-primary">Active sessions</h2>
          </div>
          {sessions.length > 1 && (
            <button onClick={revokeOthers} className="text-xs font-semibold text-danger hover:underline">
              Revoke other sessions
            </button>
          )}
        </div>
        <div className="space-y-2">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between gap-3 rounded-md border border-base px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs text-primary truncate">{session.userAgent || "Unknown device"}</div>
                <div className="text-[11px] text-muted">{session.ipAddress || "Unknown IP"} · {new Date(session.createdAt).toLocaleString()}</div>
              </div>
              <button onClick={() => revokeSession(session.id)} title="Revoke session" className="p-1.5 text-muted hover:text-danger">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {sessions.length === 0 && <p className="text-sm text-muted">No active sessions found.</p>}
        </div>
      </section>
    </div>
  );
}
