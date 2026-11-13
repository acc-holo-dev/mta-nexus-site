export const notificationPreferenceKeys = [
  "followsEnabled",
  "contentEnabled",
  "serverEnabled",
  "commerceEnabled",
  "systemEnabled",
] as const;

export type NotificationPreferences = {
  followsEnabled: boolean;
  contentEnabled: boolean;
  serverEnabled: boolean;
  commerceEnabled: boolean;
  systemEnabled: boolean;
};

export function parseNotificationPreferences(value: unknown): NotificationPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (!notificationPreferenceKeys.every((key) => typeof record[key] === "boolean")) {
    return null;
  }

  return {
    followsEnabled: record.followsEnabled as boolean,
    contentEnabled: record.contentEnabled as boolean,
    serverEnabled: record.serverEnabled as boolean,
    commerceEnabled: record.commerceEnabled as boolean,
    systemEnabled: record.systemEnabled as boolean,
  };
}

export function confirmedNotificationPreferences(value: unknown): NotificationPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.success !== true) return null;
  return parseNotificationPreferences(record.preferences);
}
