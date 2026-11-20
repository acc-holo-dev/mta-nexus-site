"use client";

import { Bell } from "lucide-react";
import type { getDictionary } from "../../../lib/i18n";
import { panelSpace4P5Shadow } from "../../shell/panel-shell";
import {
  typeBlockSmPrimary,
  typeFlexCenterGap2,
  typeFlexCursorBetweenGap4Py3,
  typeIconAccent,
  typeMt05BlockXsMuted,
  typeSmSemiboldPrimary,
  typeXsMuted,
} from "../../shell/type-shell";
import type { NotificationPreferences } from "../notification-preferences-confirmation";
import { type PushIdentity, WebPushSettings } from "./web-push-settings";

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
  pushIdentity: PushIdentity | null;
  onPreferenceChange: (key: PreferenceKey, value: boolean) => void;
};

export function SettingsNotificationPreferencesSection({
  copy,
  preferences,
  preferenceLabels,
  pending,
  pushIdentity,
  onPreferenceChange,
}: Props) {
  return (
    <section aria-labelledby="notification-heading" className={panelSpace4P5Shadow}>
      <div className={typeFlexCenterGap2}>
        <Bell className={typeIconAccent} aria-hidden="true" />
        <h2 id="notification-heading" className={typeSmSemiboldPrimary}>
          {copy.notificationPreferences}
        </h2>
      </div>
      <p className={typeXsMuted}>{copy.notificationDescription}</p>
      <div className="divide-y divide-base">
        {preferences &&
          preferenceLabels.map(({ key, label, description }) => (
            <label key={key} className={typeFlexCursorBetweenGap4Py3}>
              <span>
                <span className={typeBlockSmPrimary}>{label}</span>
                <span className={typeMt05BlockXsMuted}>{description}</span>
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
      <WebPushSettings expectedIdentity={pushIdentity} />
    </section>
  );
}
