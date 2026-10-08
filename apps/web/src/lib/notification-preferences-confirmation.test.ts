import { describe, expect, it } from "vitest";
import {
  confirmedNotificationPreferences,
  notificationPreferenceKeys,
  parseNotificationPreferences,
} from "./notification-preferences-confirmation";

const preferences = {
  followsEnabled: true,
  contentEnabled: false,
  serverEnabled: true,
  commerceEnabled: false,
  systemEnabled: true,
};

describe("notification preference confirmation", () => {
  it("parses only the complete canonical boolean preference set", () => {
    expect(notificationPreferenceKeys).toEqual([
      "followsEnabled",
      "contentEnabled",
      "serverEnabled",
      "commerceEnabled",
      "systemEnabled",
    ]);
    expect(
      parseNotificationPreferences({
        ...preferences,
        ignoredServerField: "not trusted",
      }),
    ).toEqual(preferences);
  });

  it.each([
    null,
    [],
    {},
    { ...preferences, followsEnabled: "true" },
    { ...preferences, contentEnabled: undefined },
    { ...preferences, systemEnabled: 1 },
  ])("rejects malformed preference state %#", (value) => {
    expect(parseNotificationPreferences(value)).toBeNull();
  });

  it("updates client state only from an explicitly successful canonical response", () => {
    expect(
      confirmedNotificationPreferences({
        success: true,
        preferences,
      }),
    ).toEqual(preferences);

    for (const value of [
      { success: false, preferences },
      { preferences },
      { success: true, preferences: null },
      {
        success: true,
        preferences: {
          ...preferences,
          commerceEnabled: "yes",
        },
      },
    ]) {
      expect(confirmedNotificationPreferences(value)).toBeNull();
    }
  });
});
