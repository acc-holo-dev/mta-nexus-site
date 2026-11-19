import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AppError, UnauthorizedError } from "@nexus/domain";
import { expect, it } from "vitest";
import { authAppErrorText } from "../../src/features/accounts/auth-app-error";

it("maps auth AppError codes to locale copy without English passthrough", () => {
  const source = readFileSync(resolve("site/src/features/accounts/auth-app-error.ts"), "utf8");
  expect(source).toContain("UNAUTHORIZED");
  expect(source).toContain("FRESH_AUTH_REQUIRED");
  expect(source).not.toMatch(/error\.message/u);
  const copy = {
    unauthorized: "Неверный email или пароль",
    freshAuthRequired: "Подтвердите текущий пароль",
    failed: "Сбой",
  };
  expect(authAppErrorText(new UnauthorizedError("Invalid email or password"), copy)).toBe(
    copy.unauthorized,
  );
  expect(authAppErrorText(new AppError("Actor missing", 428, "ACTOR_ID_REQUIRED"), copy)).toBe(
    copy.unauthorized,
  );
  expect(
    authAppErrorText(
      new AppError("Current password is required", 401, "FRESH_AUTH_REQUIRED"),
      copy,
    ),
  ).toBe(copy.freshAuthRequired);
  expect(authAppErrorText(new AppError("Weird", 500, "INTERNAL_ERROR"), copy)).toBe(copy.failed);
});
