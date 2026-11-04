"use client";

import { Button, EmptyState } from "@nexus/ui";
import { Monitor } from "lucide-react";
import type { getDictionary } from "../lib/i18n";
import type { SettingsSession } from "../lib/settings-client-api";

type SettingsCopy = ReturnType<typeof getDictionary>["settings"];

type Props = {
  copy: SettingsCopy;
  sessions: SettingsSession[] | null;
  pending: boolean;
  dateLocale: string;
  onReload: () => void;
  onRevokeOthers: () => void;
  onRevokeSession: (sessionId: string, sessionLabel: string) => void;
};

export function SettingsActiveSessions({
  copy,
  sessions,
  pending,
  dateLocale,
  onReload,
  onRevokeOthers,
  onRevokeSession,
}: Props) {
  return (
    <section
      aria-labelledby="sessions-heading"
      className="nexus-panel space-y-4 p-5 shadow-nexus-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2 id="sessions-heading" className="text-sm font-semibold text-primary">
            {copy.activeSessions}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="touch"
          disabled={pending}
          onClick={onReload}
          className="h-auto px-0 font-semibold text-accent"
        >
          {copy.reloadSettings}
        </Button>
      </div>

      <p className="text-sm text-muted">{copy.sessionsDescription}</p>

      {sessions && sessions.length > 1 && (
        <Button
          type="button"
          variant="ghost"
          size="touch"
          disabled={pending}
          onClick={() => void onRevokeOthers()}
          className="h-auto px-0 font-semibold text-danger"
        >
          {copy.endOtherSessions}
        </Button>
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
              <span className="text-xs font-semibold text-accent">{copy.thisBrowser}</span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="touch"
                disabled={pending}
                onClick={() =>
                  void onRevokeSession(session.id, session.userAgent || copy.deviceUnavailable)
                }
                className="h-auto px-0 font-semibold text-danger"
              >
                {copy.endSession}
              </Button>
            )}
          </div>
        ))}

        {sessions === null && <p className="text-sm text-muted">{copy.sessionUnavailable}</p>}

        {sessions?.length === 0 ? (
          <EmptyState title={copy.noSessions} description={copy.sessionsDescription} />
        ) : null}
      </div>
    </section>
  );
}
