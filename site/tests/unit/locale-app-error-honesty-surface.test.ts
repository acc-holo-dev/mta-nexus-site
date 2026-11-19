import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AppError, UnauthorizedError } from "@nexus/domain";
import { expect, it } from "vitest";
import { localeAppErrorText } from "../../src/lib/http/locale-app-error";

it("maps AppError codes to locale copy without English passthrough", () => {
  const source = readFileSync(resolve("site/src/lib/http/locale-app-error.ts"), "utf8");
  expect(source).toContain("UNAUTHORIZED");
  expect(source).toContain("FORBIDDEN");
  expect(source).toContain("NOT_FOUND");
  expect(source).not.toMatch(/error\.message/u);

  const copy = {
    unauthorized: "Нет доступа",
    forbidden: "Запрещено",
    notFound: "Не найдено",
    conflict: "Конфликт",
    unsupportedMediaType: "Неверный тип",
    requestBodyTooLarge: "Слишком большой",
    failed: "Сбой",
  };

  expect(localeAppErrorText(new UnauthorizedError("Invalid email or password"), copy)).toBe(
    copy.unauthorized,
  );
  expect(localeAppErrorText(new AppError("Denied", 403, "FORBIDDEN"), copy)).toBe(copy.forbidden);
  expect(localeAppErrorText(new AppError("Missing", 404, "NOT_FOUND"), copy)).toBe(copy.notFound);
  expect(localeAppErrorText(new AppError("Clash", 409, "CONFLICT"), copy)).toBe(copy.conflict);
  expect(
    localeAppErrorText(new AppError("Bad type", 415, "UNSUPPORTED_MEDIA_TYPE"), copy),
  ).toBe(copy.unsupportedMediaType);
  expect(
    localeAppErrorText(new AppError("Too big", 413, "REQUEST_BODY_TOO_LARGE"), copy),
  ).toBe(copy.requestBodyTooLarge);
  expect(localeAppErrorText(new AppError("Weird", 500, "INTERNAL_ERROR"), copy)).toBe(copy.failed);
  expect(
    localeAppErrorText(new AppError("Own target", 400, "REPORT_OWN_TARGET"), copy, {
      REPORT_OWN_TARGET: "Нельзя на себя",
    }),
  ).toBe("Нельзя на себя");
});
