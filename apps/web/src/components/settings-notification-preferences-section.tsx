"use client";

import { Bell } from "lucide-react";
import type { getDictionary } from "../lib/i18n";
import type { NotificationPreferences } from "../lib/notification-preferences-confirmation";
import { WebPushSettings } from "./web-push-settings";

type SettingsCopy = ReturnType<typeof getDictionary>["settings"];

type PreferenceKey = keyof NotificationPreferences;

type Props = {
  copy: SettingsCopy;
  preferences: NotificationPreferences | null;
  preferenceLabels: Array<{
    key: PreferenceKey;
    label: string;
    description: string;
  }>;
  pending: boolean;
  onPreferenceChange: (key: PreferenceKey, value: boolean) => void;
};

export function SettingsNotificationPreferencesSection({
  copy,
  preferences,
  preferenceLabels,
  pending,
  onPreferenceChange,
}: Props) {
  return (
    <section
      aria-labelledby="notification-heading"
      className="nexus-panel space-y-4 p-5 shadow-nexus-sm"
    >
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-accent" aria-hidden="true" />
        <h2 id="notification-heading" className="text-sm font-semibold text-primary">
          {copy.notificationPreferences}
        </h2>
      </div>
      <p className="text-xs text-muted">{copy.notificationDescription}</p>
      <div className="divide-y divide-base">
        {preferences &&
          preferenceLabels.map(({ key, label, description }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between gap-4 py-3"
            >
              <span>
                <span className="block text-sm text-primary">{label}</span>
                <span className="mt-0.5 block text-xs text-muted">{description}</span>
              </span>
              <input
                type="checkbox"
                checked={preferences[key]}
                disabled={pending}
                onChange={(event) => onPreferenceChange(key, event.target.checked)}
                className={`h-4 w-4 accent-[var(--nexus-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]`}
              />
            </label>
          ))}
      </div>
      <WebPushSettings />
    </section>
  );
}
