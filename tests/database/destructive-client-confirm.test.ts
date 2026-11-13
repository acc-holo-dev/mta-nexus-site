import { describe, expect, it } from "vitest";
import { getDiscussionCopy } from "../../site/src/lib/content-discussion-copy";
import { reactionCopy } from "../../site/src/lib/content-reaction-copy";
import { getDictionary } from "../../site/src/lib/i18n";
import { getResourceCommerceCopy } from "../../site/src/lib/resource-commerce-i18n";
import { resourceMediaCopy } from "../../site/src/lib/resource-media-i18n";

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

  it.each(locales)("defines discussion comment removal confirm strings (%s)", (locale) => {
    const copy = getDiscussionCopy(locale);
    expect(copy.removeConfirmTitle.length).toBeGreaterThan(0);
    expect(copy.moderateRemoveConfirmTitle.length).toBeGreaterThan(0);
    expect(copy.removeNote.length).toBeGreaterThan(0);
    expect(copy.moderateRemoveNote.length).toBeGreaterThan(0);
    expect(copy.confirmRemove.length).toBeGreaterThan(0);
    expect(copy.cancelEdit.length).toBeGreaterThan(0);
  });

  it.each(locales)("defines resource gallery removal confirm strings (%s)", (locale) => {
    const copy = resourceMediaCopy(locale);
    expect(copy.removeConfirmTitle.length).toBeGreaterThan(0);
    expect(copy.removeConfirm.length).toBeGreaterThan(0);
    expect(copy.confirm.length).toBeGreaterThan(0);
    expect(copy.cancel.length).toBeGreaterThan(0);
  });
});
