import { expect, it } from "vitest";
import {
  profilePrivacyUpdateSchema,
  parseEditablePrivacy,
  confirmedPrivacyUpdate,
} from "../apps/web/src/lib/profile-privacy-contract";
import {
  profilePrivacyCopy,
  profilePrivacyError,
  profilePrivacyMutationError,
} from "../apps/web/src/lib/profile-privacy-copy";
const previous = {
  id: "user",
  username: "member",
  showActivity: true,
  showProfessionalContacts: true,
  updatedAt: "2026-10-10T00:00:00.000Z",
};
const fields = { showActivity: false, showProfessionalContacts: false };
const saved = { ...previous, ...fields, updatedAt: "2026-10-10T00:00:00.001Z" };
it("requires explicit boolean visibility and the shared revision, with no actor or trust fields", () => {
  const valid = { ...fields, expectedUpdatedAt: previous.updatedAt };
  expect(profilePrivacyUpdateSchema.parse(valid)).toEqual(valid);
  for (const value of [
    { ...valid, userId: "victim" },
    { ...valid, verifiedDeveloper: true },
    { ...valid, showActivity: "false" },
    { ...valid, showProfessionalContacts: null },
    { showActivity: true, expectedUpdatedAt: previous.updatedAt },
    { ...fields },
    { ...valid, expectedUpdatedAt: "not-a-date" },
  ])
    expect(profilePrivacyUpdateSchema.safeParse(value).success).toBe(false);
});
it("accepts only narrow saved preferences and confirms identity, exact visibility and a newer revision", () => {
  expect(parseEditablePrivacy(saved)).toEqual(saved);
  expect(confirmedPrivacyUpdate({ success: true, preferences: saved }, previous, fields)).toEqual(
    saved,
  );
  for (const preferences of [
    null,
    {},
    { ...saved, email: "private" },
    { ...saved, id: "victim" },
    { ...saved, username: "other" },
    { ...saved, updatedAt: previous.updatedAt },
    { ...saved, showActivity: true },
    { ...saved, showProfessionalContacts: true },
    { ...saved, updatedAt: "2025-10-10T00:00:00.000Z" },
  ])
    expect(confirmedPrivacyUpdate({ success: true, preferences }, previous, fields)).toBeNull();
  for (const response of [null, {}, { preferences: saved }, { success: false, preferences: saved }])
    expect(confirmedPrivacyUpdate(response, previous, fields)).toBeNull();
});
it.each(["en", "ru"] as const)(
  "localizes all labels, stale versions and uncertain writes in %s",
  (locale) => {
    const copy = profilePrivacyCopy(locale);
    expect(Object.keys(copy)).toEqual(Object.keys(profilePrivacyCopy("en")));
    expect(Object.values(copy).every((value) => value.length > 0)).toBe(true);
    expect(profilePrivacyError(locale, "CONFLICT")).toBe(copy.conflict);
    expect(profilePrivacyError(locale, "UNAUTHORIZED")).toBe(copy.signIn);
    expect(profilePrivacyError(locale, "unknown internal SQL")).toBe(copy.unavailable);
    expect(profilePrivacyMutationError(locale, "unknown internal SQL")).toBe(copy.uncertain);
    expect(profilePrivacyMutationError(locale, "UNCONFIRMED")).toBe(copy.unconfirmed);
  },
);
