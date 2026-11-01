import { describe, expect, it } from "vitest";
import { reactionCopy } from "../apps/web/src/lib/content-reaction-copy";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { getResourceCommerceCopy } from "../apps/web/src/lib/resource-commerce-i18n";

const locales = ["en", "ru"] as const;

describe("destructive client confirm copy", () => {
  it.each(locales)("defines session and push confirm strings in settings (%s)", (locale) => {
    const copy = getDictionary(locale).settings;
    for (const key of [
      "cancel",
      "endSessionConfirmTitle",
      "endSessionConfirm",
      "endOtherSessionsConfirmTitle",
      "endOtherSessionsConfirm",
      "webPushDisableConfirmTitle",
      "webPushDisableConfirm",
    ] as const) {
      expect(copy[key]?.length).toBeGreaterThan(0);
    }
    expect(copy.endSessionConfirmTitle).not.toBe(copy.endOtherSessionsConfirmTitle);
  });

  it.each(locales)("defines reaction removal confirm strings (%s)", (locale) => {
    const copy = reactionCopy(locale);
    expect(copy.removeConfirmTitle.length).toBeGreaterThan(0);
    expect(copy.removeConfirm.length).toBeGreaterThan(0);
    expect(copy.cancel.length).toBeGreaterThan(0);
  });

  it.each(locales)("defines cart line removal confirm strings (%s)", (locale) => {
    const copy = getResourceCommerceCopy(locale);
    expect(copy.removeConfirmTitle.length).toBeGreaterThan(0);
    expect(copy.removeConfirm.length).toBeGreaterThan(0);
    expect(copy.cancel.length).toBeGreaterThan(0);
  });
});
