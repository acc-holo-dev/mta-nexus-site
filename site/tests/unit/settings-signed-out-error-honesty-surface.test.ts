import { expect, it } from "vitest";
import {
  isSettingsSignedOutError,
  SettingsRequestError,
} from "../../src/features/accounts/settings-client-api";

it("treats EN and RU authentication-required 401 as signed out, not wrong-password", () => {
  expect(
    isSettingsSignedOutError(new SettingsRequestError("Authentication required", 401)),
  ).toBe(true);
  expect(isSettingsSignedOutError(new SettingsRequestError("Требуется вход", 401))).toBe(true);
  expect(
    isSettingsSignedOutError(new SettingsRequestError("Current password is incorrect", 401, "UNAUTHORIZED")),
  ).toBe(false);
  expect(
    isSettingsSignedOutError(new SettingsRequestError("Текущий пароль неверен", 401, "UNAUTHORIZED")),
  ).toBe(false);
  expect(isSettingsSignedOutError(new SettingsRequestError("Authentication required", 403))).toBe(
    false,
  );
});
